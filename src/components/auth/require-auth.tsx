"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";

/** Gate for auth-only pages: redirects guests to /login, spins while resolving. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "guest") return;
    // Preserve where the guest was headed so login can return them there. Read
    // the query from the live URL (client-only) rather than useSearchParams(),
    // which would force a Suspense boundary on this statically-rendered page.
    const qs = typeof window !== "undefined" ? window.location.search : "";
    const here = `${pathname}${qs}`;
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [status, router, pathname]);

  if (status !== "authed") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}
