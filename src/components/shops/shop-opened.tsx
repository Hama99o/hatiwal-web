"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Check, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { UserIdentity } from "@/components/shared/user-identity";
import { ShareButton } from "@/components/shared/share-button";
import { Button } from "@/components/ui/button";
import { getMyListings } from "@/lib/api/me";
import { moveListingsToShop, type Shop } from "@/lib/api/shops";
import { useSellingIdentity } from "./use-selling-identity";
import { shopShareUrl } from "./shop-page-view";

/**
 * "Your shop is open! 🎉" (docs/SHOPS.md step 8): the checklist, same as mobile:
 * add your first product (sell as the shop), move your listings (all ticked),
 * share your shop. Motion is a CSS fade, off under prefers-reduced-motion.
 */
export function ShopOpened({ shop }: { shop: Shop }) {
  const t = useTranslations("shops");
  const router = useRouter();
  const qc = useQueryClient();
  const { switchToAsync } = useSellingIdentity();
  const [moving, setMoving] = useState(false);
  const [unticked, setUnticked] = useState<Set<number>>(new Set());
  const [moved, setMoved] = useState(false);

  const { data: mine } = useQuery({ queryKey: ["my-listings", "move-candidates"], queryFn: getMyListings, enabled: moving });
  const candidates = (mine ?? []).filter((l) => !l.shop && l.status === "active");
  const chosen = candidates.filter((l) => !unticked.has(l.id)).map((l) => l.id);

  const move = useMutation({
    mutationFn: () => moveListingsToShop(shop.id, chosen),
    onSuccess: (count) => {
      toast.success(t("form.done.moved", { count }));
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      setMoving(false);
      setMoved(true);
    },
    onError: () => toast.error(t("form.review.failed")),
  });

  if (moving) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-8" data-testid="shop-move-listings">
        <h1 className="text-2xl font-extrabold">{t("form.done.moveTitle")}</h1>
        {mine && candidates.length === 0 && <p className="text-muted-foreground">{t("form.done.noListings")}</p>}
        <ul className="space-y-2">
          {candidates.map((l) => (
            <li key={l.id}>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={!unticked.has(l.id)}
                  onChange={(e) => setUnticked((s) => { const n = new Set(s); if (e.target.checked) n.delete(l.id); else n.add(l.id); return n; })}
                  data-testid={`shop-move-${l.id}`}
                />
                <span className="truncate" dir="auto">{l.title}</span>
              </label>
            </li>
          ))}
        </ul>
        <Button className="w-full" disabled={!chosen.length || move.isPending} onClick={() => move.mutate()} data-testid="shop-move-confirm">
          {t("form.done.moveButton", { count: chosen.length })}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setMoving(false)}>
          {t("form.back")}
        </Button>
      </div>
    );
  }

  const row = "flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-start font-semibold hover:bg-accent";
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-10" data-testid="shop-open-success">
      <div className="space-y-2 text-center motion-safe:animate-in motion-safe:fade-in">
        <CheckCircle2 className="mx-auto size-16 text-success" />
        <h1 className="text-2xl font-extrabold">{t("form.done.title")} 🎉</h1>
        <p className="text-muted-foreground">{t("form.done.subtitle")}</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <UserIdentity variant="shop" name={shop.name} avatarUrl={shop.logoUrl} verified={shop.verified} size={48} />
      </div>
      <button type="button" className={row} data-testid="shop-opened-add-product" onClick={async () => { await switchToAsync(shop.id); router.push("/listings/new"); }}>
        <Plus className="size-5 text-primary" /> {t("form.done.addProduct")}
      </button>
      <button type="button" className={row} data-testid="shop-opened-move-listings" onClick={() => setMoving(true)}>
        {moved ? <Check className="size-5 text-success" /> : <ArrowRightLeft className="size-5 text-primary" />} {t("form.done.moveListings")}
      </button>
      <div data-testid="shop-opened-share">
        <ShareButton shareTitle={shop.name} text={t("share.body", { name: shop.name })} url={shopShareUrl(shop)} label={t("form.done.share")} className="w-full" testId="shop-opened-share-button" />
      </div>
      <Button asChild variant="outline" className="w-full" data-testid="shop-opened-view">
        <Link href={`/shops/${shop.id}`}>{t("form.done.view")}</Link>
      </Button>
    </div>
  );
}
