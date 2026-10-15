"use client";

import { useId, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Mail, MoreHorizontal, Send, UserPlus, Users } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { getMyShop } from "@/lib/api/shops";
import { canRemoveMember, shopCan } from "@/lib/shop-permissions";
import {
  cancelShopInvite,
  changeShopMemberRole,
  createShopInvite,
  getShopInvites,
  getShopMembers,
  leaveShop,
  removeShopMember,
  resendShopInvite,
  transferShop,
  teamErrorCode,
  teamErrorMessage,
  type ShopInvite,
  type ShopMember,
} from "@/lib/api/shop-team";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * SHOP-3 Team (T1 / T2 / T3 / T7), web twin of mobile's TeamScreen, same
 * testids. Who may do what is the one Owner / Manager / Staff matrix
 * (shopCan, api 76ca115): owner and managers invite and remove staff; only
 * the owner changes roles, removes a manager and transfers the shop; managers
 * and staff can leave.
 */
export function TeamView({ shopId }: { shopId: number }) {
  const hydrated = useHydrated();
  const t = useTranslations("shops");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, refresh, setUser } = useAuth();
  const titleId = useId();
  const [sheet, setSheet] = useState<null | "invite" | "email" | "sent">(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<ShopInvite | null>(null);
  const [removing, setRemoving] = useState<ShopMember | null>(null);
  const [cancelling, setCancelling] = useState<ShopInvite | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [transferring, setTransferring] = useState<ShopMember | null>(null);
  const [now] = useState(() => Date.now());

  const { data: shop } = useQuery({ queryKey: ["shop", shopId], queryFn: () => getMyShop(shopId) });
  const role = shop?.role ?? null;
  const canInvite = shopCan(role, "manageInvites");
  const canChangeRole = shopCan(role, "changeRole");
  const { data: members, isPending, isError, error: membersError, refetch } = useQuery({ queryKey: ["shop-members", shopId], queryFn: () => getShopMembers(shopId) });
  const { data: invites } = useQuery({ queryKey: ["shop-invites", shopId], queryFn: () => getShopInvites(shopId), enabled: canInvite });
  const pending = (invites ?? []).filter((i) => i.status === "pending");

  const failed = (err: unknown) => {
    toast.error(teamErrorMessage(err, tRoot));
    // Refused because MY role changed meanwhile (made Staff, removed, the shop
    // handed over; edge-case pass 2026-10-08): reload who I am here, so the
    // buttons I may no longer use go away instead of failing again.
    const code = teamErrorCode(err);
    if (code === "forbidden" || code === "not_a_member") {
      qc.invalidateQueries({ queryKey: ["shop", shopId] });
      qc.invalidateQueries({ queryKey: ["shop-members", shopId] });
      qc.invalidateQueries({ queryKey: ["shop-invites", shopId] });
    }
  };
  const reload = () => {
    qc.invalidateQueries({ queryKey: ["shop-members", shopId] });
    qc.invalidateQueries({ queryKey: ["shop-invites", shopId] });
  };

  const shareInvite = async (invite: ShopInvite) => {
    const text = `${t("team.shareText", { shop: shop?.name ?? "" })}\n${invite.url}`;
    try {
      if (navigator.share) await navigator.share({ title: shop?.name, text, url: invite.url });
      else {
        await navigator.clipboard.writeText(invite.url);
        toast.success(t("team.linkCopied"));
      }
    } catch (err) {
      // Dismissing the share sheet is not a failure; anything else is.
      if ((err as Error)?.name !== "AbortError") toast.error(t("team.shareFailed"));
    }
  };

  const create = useMutation({
    mutationFn: (byEmail?: string) => createShopInvite(shopId, byEmail),
    onSuccess: (invite) => {
      reload();
      setSent(invite);
      setEmail("");
      setSheet("sent");
    },
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: (userId: number) => removeShopMember(shopId, userId),
    onSuccess: () => {
      reload();
      setRemoving(null);
      toast.success(t("team.removed"));
    },
    onError: failed,
  });
  const cancel = useMutation({
    mutationFn: (id: number) => cancelShopInvite(shopId, id),
    onSuccess: () => {
      reload();
      setCancelling(null);
    },
    onError: failed,
  });
  const resend = useMutation({
    mutationFn: (id: number) => resendShopInvite(shopId, id),
    onSuccess: () => {
      reload();
      toast.success(t("team.resent"));
    },
    onError: failed,
  });
  const changeRole = useMutation({
    mutationFn: ({ member, to }: { member: ShopMember; to: "manager" | "staff" }) => changeShopMemberRole(shopId, member.user.id, to),
    onSuccess: (_m, { member, to }) => {
      reload();
      toast.success(t("team.roleChanged", { name: member.user.name, role: t(`roles.${to}`) }));
    },
    onError: failed,
  });
  const transfer = useMutation({
    mutationFn: (member: ShopMember) => transferShop(shopId, member.user.id),
    onSuccess: ({ me }, member) => {
      // The answer carries the caller's fresh `me` (now a Manager here).
      if (me) setUser(me);
      setTransferring(null);
      reload();
      qc.invalidateQueries({ queryKey: ["shop", shopId] });
      qc.invalidateQueries({ queryKey: ["my-shops"] });
      toast.success(t("team.transferred", { name: member.user.name }));
    },
    onError: (err) => {
      setTransferring(null);
      failed(err);
    },
  });
  const leave = useMutation({
    mutationFn: () => leaveShop(shopId),
    onSuccess: async () => {
      await refresh();
      toast.success(t("team.left", { shop: shop?.name ?? "" }));
      router.push("/profile");
    },
    onError: failed,
  });

  // Not (or no longer) a member: the shop says so, or the members list 403s
  // (removed while this page was open).
  if ((shop && !shop.role) || teamErrorCode(membersError) === "not_a_member") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16" data-testid="team-not-member">
        <EmptyState icon={Users} title={t("team.errors.not_a_member")} action={{ label: t("team.join.toBazaar"), href: "/bazaar" }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8" data-testid="shop-team">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-title font-extrabold">{t("team.heading", { shop: shop?.name ?? "" })}</h1>
        {canInvite && (
          <Button onClick={() => setSheet("invite")} data-testid="team-invite">
            <UserPlus className="size-4" /> {t("team.invite")}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t("team.subtitle")}</p>

      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : isError ? (
        <EmptyState icon={Users} title={t("team.loadError")} action={{ label: t("states.retry"), onClick: () => refetch() }} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {(members ?? []).map((m) => (
            <li key={m.user.id} className="flex items-center gap-3 p-3" data-testid={`team-member-${m.user.id}`}>
              <UserAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} avatarFallbackUrl={m.user.avatarOriginalUrl} size={40} />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {m.user.name}
                {m.user.id === user?.id ? ` · ${t("team.you")}` : ""}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold" data-testid={`team-member-role-${m.user.id}`}>
                {t(`roles.${m.role}`)}
              </span>
              {m.role !== "owner" && m.user.id !== user?.id && (canChangeRole || canRemoveMember(role, m.role)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label={tc("actions")} data-testid={`team-member-menu-${m.user.id}`} className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-accent">
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canChangeRole && m.role === "staff" && (
                      <DropdownMenuItem onClick={() => changeRole.mutate({ member: m, to: "manager" })} data-testid="member-make-manager">
                        {t("team.makeManager")}
                      </DropdownMenuItem>
                    )}
                    {canChangeRole && m.role === "manager" && (
                      <DropdownMenuItem onClick={() => changeRole.mutate({ member: m, to: "staff" })} data-testid="member-make-staff">
                        {t("team.makeStaff")}
                      </DropdownMenuItem>
                    )}
                    {shopCan(role, "transfer") && (
                      <DropdownMenuItem onClick={() => setTransferring(m)} data-testid="member-transfer">
                        {t("team.transfer")}
                      </DropdownMenuItem>
                    )}
                    {canRemoveMember(role, m.role) && (
                      <DropdownMenuItem onClick={() => setRemoving(m)} data-testid="member-remove" className="text-destructive">
                        {t("team.remove")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}

      {canInvite && !isPending && (members?.length ?? 0) <= 1 && pending.length === 0 && (
        <div data-testid="team-alone">
          <EmptyState icon={Users} title={t("team.alone")} action={{ label: t("team.invite"), onClick: () => setSheet("invite") }} />
        </div>
      )}

      {canInvite && pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">{t("team.pending")}</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {pending.map((i) => {
              const days = Math.max(0, Math.ceil((new Date(i.expiresAt).getTime() - now) / 86_400_000));
              return (
                <li key={i.id} className="flex items-center gap-3 p-3" data-testid={`team-invite-row-${i.id}`}>
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                    {i.email ? <Mail className="size-4 text-muted-foreground" /> : <Link2 className="size-4 text-muted-foreground" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    {i.email ? (
                      <span className="block truncate" dir="ltr">{i.email}</span>
                    ) : (
                      <span className="block truncate">{t("team.linkSent", { date: formatDate(i.createdAt, locale) })}</span>
                    )}
                    <span className="block text-sm text-muted-foreground">
                      {t(`roles.${i.role}`)} · {t("team.expiresIn", { count: days })}
                    </span>
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger aria-label={tc("actions")} data-testid={`team-invite-menu-${i.id}`} className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-accent">
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {i.email ? (
                        // Bound to that address: re-notify it, never hand its link to someone else.
                        <DropdownMenuItem onClick={() => resend.mutate(i.id)} data-testid="invite-resend">
                          {t("team.resend")}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => shareInvite(i)} data-testid="invite-share">
                          {t("team.shareAgain")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setCancelling(i)} data-testid="invite-cancel" className="text-destructive">
                        {t("team.cancelInvite")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {shopCan(role, "leave") && (
        <Button variant="outline" className="text-destructive" onClick={() => setLeaving(true)} data-testid="team-leave">
          {t("team.leave")}
        </Button>
      )}

      <Dialog open={sheet !== null} onClose={() => setSheet(null)} labelledBy={titleId} className="max-w-md">
        <div className="space-y-3 p-5">
          {sheet === "invite" && (
            <div className="space-y-3" data-testid="team-invite-sheet">
              <h2 id={titleId} className="text-lg font-extrabold">{t("team.invite")}</h2>
              <p className="text-sm text-muted-foreground">{t("team.inviteAsStaff")}</p>
              <Button className="w-full" onClick={() => create.mutate(undefined)} disabled={create.isPending} data-testid="invite-share-link">
                <Link2 className="size-4" /> {t("team.shareLink")}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setSheet("email")} data-testid="invite-by-contact">
                <Mail className="size-4" /> {t("team.byEmail")}
              </Button>
            </div>
          )}
          {sheet === "email" && (
            <form
              method="post"
              className="space-y-3"
              data-testid="team-email-sheet"
              onSubmit={(e) => {
                e.preventDefault();
                if (EMAIL.test(email.trim())) create.mutate(email.trim());
              }}
            >
              <h2 id={titleId} className="text-lg font-extrabold">{t("team.byEmail")}</h2>
              <p className="text-sm text-muted-foreground">{t("team.emailHint")}</p>
              <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" aria-label={t("team.byEmail")} data-testid="invite-contact-input" />
              {email.length > 3 && !EMAIL.test(email.trim()) && <p className="text-sm text-destructive">{t("team.emailInvalid")}</p>}
              <Button type="submit" className="w-full" disabled={!hydrated || create.isPending || !EMAIL.test(email.trim())} data-testid="invite-send">
                <Send className="size-4" /> {t("team.send")}
              </Button>
            </form>
          )}
          {sheet === "sent" && sent && (
            <div className="space-y-3 text-center" data-testid="invite-sent">
              <h2 id={titleId} className="text-lg font-extrabold">{t("team.sentTitle")}</h2>
              <p className="text-sm text-muted-foreground">{sent.email ? t("team.sentEmail", { email: sent.email }) : t("team.sentLink")}</p>
              {!sent.email && (
                <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-start text-sm" data-testid="invite-url">
                  <span className="min-w-0 flex-1 truncate" dir="ltr">{sent.url}</span>
                  {/* 44px target (it was the 16px icon alone), and a failed copy
                      says so instead of "Link copied" (design QA 1.1.6). */}
                  <button
                    type="button"
                    aria-label={t("team.copyLink")}
                    data-testid="invite-copy-link"
                    className="-my-2 -me-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-background"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(sent.url);
                        toast.success(t("team.linkCopied"));
                      } catch {
                        toast.error(tc("error"));
                      }
                    }}
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
              )}
              {!sent.email && (
                <Button className="w-full" onClick={() => shareInvite(sent)} data-testid="invite-share-again">
                  {t("team.shareAgain")}
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={() => setSheet("invite")} data-testid="invite-another">
                {t("team.inviteAnother")}
              </Button>
            </div>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        title={t("team.removeTitle", { name: removing?.user.name ?? "" })}
        description={t("team.removeBody", { name: removing?.user.name ?? "" })}
        confirmLabel={t("team.remove")}
        cancelLabel={tc("cancel")}
        destructive
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.user.id)}
        onCancel={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={cancelling !== null}
        title={t("team.cancelTitle")}
        description={t("team.cancelBody")}
        confirmLabel={t("team.cancelInvite")}
        cancelLabel={tc("cancel")}
        destructive
        loading={cancel.isPending}
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
        onCancel={() => setCancelling(null)}
      />
      <ConfirmDialog
        open={transferring !== null}
        title={t("team.transferTitle", { name: transferring?.user.name ?? "" })}
        description={t("team.transferBody", { name: transferring?.user.name ?? "" })}
        confirmLabel={t("team.transferConfirm")}
        cancelLabel={tc("cancel")}
        destructive
        loading={transfer.isPending}
        onConfirm={() => transferring && transfer.mutate(transferring)}
        onCancel={() => setTransferring(null)}
      />
      <ConfirmDialog
        open={leaving}
        title={t("team.leaveTitle", { shop: shop?.name ?? "" })}
        description={t("team.leaveBody")}
        confirmLabel={t("team.leave")}
        cancelLabel={tc("cancel")}
        destructive
        loading={leave.isPending}
        onConfirm={() => leave.mutate()}
        onCancel={() => setLeaving(false)}
      />
    </div>
  );
}
