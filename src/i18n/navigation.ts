import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation helpers. ALWAYS import `Link` / `useRouter` from here
 * (never from `next/link` / `next/navigation`) so the active locale prefix is
 * preserved across navigations.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
