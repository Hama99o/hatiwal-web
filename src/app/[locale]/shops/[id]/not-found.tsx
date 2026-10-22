import { useTranslations } from "next-intl";
import { Store } from "lucide-react";
import { ResourceNotFound } from "@/components/shared/resource-not-found";

/** A shop that is gone, suspended or never existed: said so, with the way back. */
export default function ShopNotFound() {
  const t = useTranslations();
  return (
    <ResourceNotFound
      icon={Store}
      title={t("common.noLongerAvailable")}
      backHref="/bazaar"
      backLabel={t("nav.browse")}
      secondaryHref="/categories"
      secondaryLabel={t("nav.categories")}
      testId="shop-unavailable"
    />
  );
}
