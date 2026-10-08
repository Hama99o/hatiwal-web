import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { VerifyFlow } from "@/components/verify/verify-flow";
import { VerificationGate } from "@/components/verify/verification-gate";
import { EmailConfirmGate } from "@/components/account/email-confirm-gate";

// VER-1: apply for the Verified badge. Private (signed-in only), not indexed.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "verify" });
  return { title: t("cta"), robots: { index: false, follow: false } };
}

export default async function VerifyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <EmailConfirmGate reason="verify">
        {/* Only when applying is possible NOW (owner, 2026-10-08). */}
        <VerificationGate>
          <VerifyFlow />
        </VerificationGate>
      </EmailConfirmGate>
    </RequireAuth>
  );
}
