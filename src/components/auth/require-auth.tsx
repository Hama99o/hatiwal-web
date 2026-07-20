"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";

/** Gate for auth-only pages: redirects guests to /login, spins while resolving. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status !== "guest") return;
    // Preserve where the guest was headed so login can return them there.
    const qs = searchParams.toString();
    const here = qs ? `${pathname}?${qs}` : pathname;
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [status, router, pathname, searchParams]);

  if (status !== "authed") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}
