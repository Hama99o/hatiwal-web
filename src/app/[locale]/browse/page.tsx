import { redirect } from "next/navigation";

// The marketplace moved to /bazaar (matching the mobile "Bazaar" naming).
// Keep this as a permanent redirect so old links / bookmarks / indexed URLs
// don't 404.
export default async function BrowseRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/bazaar`);
}
