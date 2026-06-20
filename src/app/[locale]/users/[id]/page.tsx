import { redirect } from "next/navigation";

// A user's public profile is the same as the seller profile — one canonical page.
export default async function UserProfileRedirect({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  redirect(`/${locale}/sellers/${id}`);
}
