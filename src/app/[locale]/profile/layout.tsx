import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NOINDEX } from "@/lib/seo";

// A sign-in or account page: nothing here for a search engine to show. These
// used to inherit the home page's canonical from [locale]/layout.tsx, which
// Search Console counted as duplicates of the home page (docs/SEO.md).
export const metadata: Metadata = { robots: NOINDEX };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
