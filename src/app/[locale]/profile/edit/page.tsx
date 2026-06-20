import { setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { EditProfileForm } from "@/components/account/edit-profile-form";

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <EditProfileForm />
    </RequireAuth>
  );
}
