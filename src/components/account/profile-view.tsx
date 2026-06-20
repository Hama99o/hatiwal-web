"use client";

import { useTranslations } from "next-intl";
import { LogOut, Pencil } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { UserIdentity } from "@/components/shared/user-identity";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end">{value}</span>
    </div>
  );
}

export function ProfileView() {
  const t = useTranslations();
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const name = user.fullName || `${user.firstname} ${user.lastname}`.trim();
  const none = t("profile.noInfo");
  const stats = [
    { label: t("profile.stats.active"), value: user.itemsActiveCount ?? 0 },
    { label: t("profile.stats.sold"), value: user.itemsSoldCount ?? 0 },
    { label: t("profile.itemsSaved"), value: user.savedItemsCount ?? 0 },
  ];

  async function onLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <UserIdentity
          name={name}
          avatarUrl={user.avatarUrl}
          verified={user.verified}
          subtitle={user.city ?? user.email}
          size={64}
        />
        <Button asChild variant="outline" size="sm">
          <Link href="/profile/edit">
            <Pencil className="size-4" />
            {t("profile.editProfile")}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4 text-center">
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("profile.info")}</h2>
        <Separator />
        <InfoRow label={t("profile.edit.fields.phone")} value={user.phone || none} />
        <InfoRow label={t("profile.edit.fields.bio")} value={user.bio || none} />
        <InfoRow label={t("profile.edit.fields.city")} value={user.city || none} />
        <InfoRow
          label={t("profile.edit.fields.province")}
          value={user.province || none}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button asChild variant="secondary">
          <Link href="/saved">{t("saved.title")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/browse">{t("profile.quickActions.browse")}</Link>
        </Button>
      </div>

      <Button
        variant="ghost"
        className="w-full text-destructive hover:text-destructive"
        onClick={onLogout}
      >
        <LogOut className="size-4" />
        {t("profile.logout")}
      </Button>
    </div>
  );
}
