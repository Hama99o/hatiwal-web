import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-7" />
      </div>
      <h1 className="text-title font-extrabold">404</h1>
      <p className="text-muted-foreground">{t("common.noResults")}</p>
      {/* Real HTTP 404 (Next sets it for not-found). The Bazaar and the
          categories are where a stale search result can still lead. */}
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/bazaar">{t("nav.browse")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/categories">{t("nav.categories")}</Link>
        </Button>
      </div>
    </div>
  );
}
