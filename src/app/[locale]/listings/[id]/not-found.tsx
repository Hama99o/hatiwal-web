import { useTranslations } from "next-intl";
import { PackageX } from "lucide-react";
import { ResourceNotFound } from "@/components/shared/resource-not-found";

/**
 * A listing that can't be shown: removed, or its shop suspended or closed
 * (SHOP-1: the API answers 404 for everyone but the seller). Says so — "This
 * item is no longer available" — with the way back to the Bazaar, plus a
 * stable `listing-unavailable` handle for e2e/QA.
 */
export default function ListingNotFound() {
  const t = useTranslations();
  return (
    <ResourceNotFound
      icon={PackageX}
      title={t("listing.detail.unavailableNotice")}
      backHref="/bazaar"
      backLabel={t("nav.browse")}
      secondaryHref="/categories"
      secondaryLabel={t("nav.categories")}
      testId="listing-unavailable"
    />
  );
}
