"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoginHref } from "@/components/auth/login-href";

/** Gate for auth-only pages: redirects guests to /login, spins while resolving. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  // Preserve where the guest was headed so login can return them there. The
  // shared helper reads the query from the live URL rather than
  // useSearchParams(), which would force a Suspense boundary on this
  // statically-rendered page — and it is the same `?next=` every gated control
  // now passes (see login-href.ts).
  const loginHref = useLoginHref();

  useEffect(() => {
    if (status !== "guest") return;
    router.replace(loginHref());
  }, [status, router, loginHref]);

  if (status !== "authed") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}
