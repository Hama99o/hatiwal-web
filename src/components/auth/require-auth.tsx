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

  // Both states hold at least one screen of height. Gated pages are client-
  // rendered: spinner → skeleton → data each had a different height, and the site
  // footer jumped up and down the viewport with them (CLS 0.12–0.52 at 390x844,
  // web UI/UX QA). With the footer kept below the fold, nothing visible moves.
  if (status !== "authed") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <div className="min-h-[100dvh]">{children}</div>;
}
