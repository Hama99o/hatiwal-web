"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CircleSlash, PartyPopper, Store, WifiOff } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { setSellerMode } from "@/lib/api/me";
import {
  acceptShopInvite,
  declineShopInvite,
  getPublicInvite,
  JOIN_PAGE_CODES,
  teamErrorCode,
  teamErrorKey,
  type TeamErrorCode,
} from "@/lib/api/shop-team";
import { useSellingIdentity } from "@/components/shops/use-selling-identity";

/** What a GET status that isn't "pending" means on the error page. */
const STATUS_CODE: Record<string, TeamErrorCode> = {
  expired: "invite_expired",
  accepted: "invite_used",
  declined: "invite_used",
  cancelled: "invite_cancelled",
};

/**
 * SHOP-3 Join (T4 / T5 / T6), web twin of mobile's JoinScreen, same testids.
 * A guest gets "Sign up to join" (/signup?invite=<token>: the token travels as
 * invite_token and the page comes back here) or Log in (?next=). Nobody joins
 * without clicking Join.
 */
export function JoinView({ token }: { token: string }) {
  const t = useTranslations("shops");
  const router = useRouter();
  const qc = useQueryClient();
  const { user, status, setUser } = useAuth();
  const { switchTo } = useSellingIdentity();
  const [refusal, setRefusal] = useState<TeamErrorCode | null>(null);
  const [joined, setJoined] = useState(false);
  const authed = status === "authed";

  const { data: invite, isPending, error, refetch, isRefetching } = useQuery({
    queryKey: ["shop-invite", token],
    queryFn: () => getPublicInvite(token),
    retry: (count, err) => count < 2 && !(err instanceof ApiError),
  });

  const accept = useMutation({
    mutationFn: () => acceptShopInvite(token),
    // The accept answer carries the fresh `me`: set it together with "joined",
    // so the page never flashes "already in this shop" in between (no second
    // /users/me round trip).
    onSuccess: ({ me }) => {
      setJoined(true);
      if (me) setUser(me);
      qc.invalidateQueries({ queryKey: ["my-shops"] });
    },
    onError: (err) => {
      const code = teamErrorCode(err);
      if (code && JOIN_PAGE_CODES.includes(code)) setRefusal(code);
      else toast.error(t(teamErrorKey(err) ?? "team.errors.generic"));
    },
  });
  const decline = useMutation({
    mutationFn: () => declineShopInvite(token),
    onSuccess: () => {
      toast.success(t("team.join.declined"));
      router.push("/bazaar");
    },
    onError: (err) => toast.error(t(teamErrorKey(err) ?? "team.errors.generic")),
  });

  const shell = (children: React.ReactNode) => <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center">{children}</div>;

  if (isPending) {
    return shell(
      <div className="flex w-full flex-col items-center gap-3" data-testid="join-loading">
        <Skeleton className="size-22 rounded-2xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>,
    );
  }

  // A failure that says nothing about the invite (offline, 5xx, 429) can be
  // retried; only "not found" reads like an expired invite.
  const httpStatus = error instanceof ApiError ? error.status : 0;
  if (error && !teamErrorCode(error) && httpStatus !== 404 && httpStatus !== 410) {
    return shell(
      <div className="flex flex-col items-center gap-4" data-testid="join-load-error">
        <WifiOff className="size-9 text-muted-foreground" />
        <h1 className="text-lg font-bold">{t("team.join.loadError")}</h1>
        <Button onClick={() => refetch()} disabled={isRefetching} data-testid="join-retry">
          {t("states.retry")}
        </Button>
      </div>,
    );
  }

  const getCode: TeamErrorCode | null = error
    ? (teamErrorCode(error) ?? "invite_expired")
    : invite && invite.status !== "pending"
      ? (STATUS_CODE[invite.status] ?? "invite_expired")
      : null;
  const alreadyMember = !!invite && !!user?.shops?.some((s) => s.id === invite.shop.id) && !joined;
  const code = refusal ?? getCode ?? (alreadyMember ? "already_member" : null);

  if (code) {
    const toShop = (code === "already_member" || code === "invite_used") && invite;
    return shell(
      <div className="flex flex-col items-center gap-4" data-testid={`join-error-${code}`}>
        <span className="flex size-18 items-center justify-center rounded-full bg-muted">
          <CircleSlash className="size-8 text-muted-foreground" />
        </span>
        <h1 className="text-xl font-extrabold">{t(`team.errors.${code}`)}</h1>
        {invite && <p className="text-muted-foreground">{invite.shop.name}</p>}
        <Button asChild data-testid="join-error-action">
          <Link href={toShop ? `/shops/${invite!.shop.id}` : "/bazaar"}>{toShop ? t("team.join.openShop") : t("team.join.toBazaar")}</Link>
        </Button>
      </div>,
    );
  }
  if (!invite) return null;

  if (joined) {
    return shell(
      <div className="flex flex-col items-center gap-4" data-testid="join-done">
        <PartyPopper className="size-11 text-primary" />
        <h1 className="text-2xl font-extrabold">{t("team.join.doneTitle", { shop: invite.shop.name })}</h1>
        <Button
          data-testid="join-start-selling"
          onClick={async () => {
            await setSellerMode(true).catch(() => null);
            switchTo(invite.shop.id);
            router.push("/my-listings");
          }}
        >
          {t("team.join.startSelling", { shop: invite.shop.name })}
        </Button>
      </div>,
    );
  }

  return shell(
    <div className="flex w-full flex-col items-center gap-4" data-testid="join-screen">
      <UserAvatar variant="shop" name={invite.shop.name} avatarUrl={invite.shop.logoUrl} size={88} />
      <h1 className="flex items-center gap-1.5 text-2xl font-extrabold">
        {invite.shop.name}
        {invite.shop.verified && <VerifiedBadge />}
      </h1>
      <p className="text-lg" data-testid="join-invited-by">
        {t("team.invitedBy", { shop: invite.shop.name, role: t(`roles.${invite.role}`) })}
      </p>
      <p className="text-sm text-muted-foreground">{t("team.join.from", { name: invite.inviterName })}</p>
      <ul className="w-full space-y-2 rounded-xl bg-muted p-4 text-start text-sm">
        {(["chats", "products", "personal"] as const).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-success" /> {t(`team.staffCan.${k}`)}
          </li>
        ))}
      </ul>
      {authed ? (
        <div className="flex w-full flex-col gap-2">
          <Button onClick={() => accept.mutate()} disabled={accept.isPending || decline.isPending} data-testid="join-accept">
            <Store className="size-4" /> {t("team.join.accept")}
          </Button>
          <Button variant="ghost" onClick={() => decline.mutate()} disabled={accept.isPending || decline.isPending} data-testid="join-decline">
            {t("team.join.decline")}
          </Button>
        </div>
      ) : status === "guest" ? (
        <div className="flex w-full flex-col gap-2">
          <Button asChild data-testid="join-signup">
            <Link href={`/signup?invite=${encodeURIComponent(token)}`}>{t("team.join.signup")}</Link>
          </Button>
          <Button asChild variant="outline" data-testid="join-login">
            <Link href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}>{t("team.join.login")}</Link>
          </Button>
        </div>
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </div>,
  );
}
