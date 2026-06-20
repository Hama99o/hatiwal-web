import type { ReactNode } from "react";

// All real markup (html/body, fonts, providers, chrome) lives in
// app/[locale]/layout.tsx. This root only needs to pass children through —
// every route is served under a locale segment via the i18n middleware.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
