import { useTranslations } from "next-intl";
import { UserX } from "lucide-react";
import { ResourceNotFound } from "@/components/shared/resource-not-found";

/** A profile that is gone (deleted account) or never existed: said so, with the way back. */
export default function SellerNotFound() {
  const t = useTranslations();
  return (
    <ResourceNotFound
      icon={UserX}
      title={t("common.noLongerAvailable")}
      backHref="/bazaar"
      backLabel={t("nav.browse")}
      testId="seller-unavailable"
    />
  );
}
