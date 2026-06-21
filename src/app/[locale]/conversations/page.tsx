import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { ConversationsView } from "@/components/chat/conversations-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chat" });
  return { title: t("title") };
}

export default async function ConversationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ listing?: string }>;
}) {
  const { locale } = await params;
  const { listing } = await searchParams;
  setRequestLocale(locale);
  const listingId = listing ? Number(listing) : undefined;
  return (
    <RequireAuth>
      <ConversationsView
        listingId={
          listingId && Number.isFinite(listingId) ? listingId : undefined
        }
      />
    </RequireAuth>
  );
}
