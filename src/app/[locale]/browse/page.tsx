import { redirect } from "next/navigation";

// The marketplace moved to /bazaar (matching the mobile "Bazaar" naming).
// Keep this as a permanent redirect so old links / bookmarks / indexed URLs
// don't 404.
export default async function BrowseRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  // Keep the filters of an old /browse?category=… link (they used to be dropped).
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    for (const one of Array.isArray(v) ? v : v != null ? [v] : []) sp.append(k, one);
  }
  const qs = sp.toString();
  redirect(`/${locale}/bazaar${qs ? `?${qs}` : ""}`);
}
