import { useTranslations } from "next-intl";
import { PackageX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * A listing that can't be shown: removed, or its shop suspended or closed
 * (SHOP-1: the API answers 404 for everyone but the seller). Same page as the
 * site 404, plus a stable `listing-unavailable` handle for e2e/QA.
 */
export default function ListingNotFound() {
  const t = useTranslations();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center" data-testid="listing-unavailable">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <PackageX className="size-7" />
      </div>
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted-foreground">{t("common.noResults")}</p>
      <Button asChild>
        <Link href="/bazaar">{t("nav.browse")}</Link>
      </Button>
    </div>
  );
}
