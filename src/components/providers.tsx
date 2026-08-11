"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/auth/auth-provider";
import { OnboardingModal } from "@/components/account/onboarding-modal";
import { installIntlNumberLocaleAlias } from "@/i18n/intl-locale-alias";

// Browser half of the digit fix (server half: `src/i18n/request.ts`). V8 ships no
// Pashto Intl data, so `ps` has to reach `Intl` as `fa-AF` — the same tag
// `src/lib/format.ts` uses — or every number next-intl formats inside a client
// island disagrees with the server HTML and React re-renders the island. This is
// the app's single client root: running it here, at module scope, puts the alias
// in place before React hydrates anything. See `@/i18n/intl-locale-alias`.
installIntlNumberLocaleAlias();

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <OnboardingModal />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
