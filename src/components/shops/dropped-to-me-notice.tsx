"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { selfSwitch, useSellingIdentity } from "./use-selling-identity";

/**
 * SHOP-1 (review): when the server drops the user back to Me (shop suspended,
 * removed or closed), say so ONCE. A switch the user made says nothing here.
 * Rendered once, in the site header. Renders nothing.
 */
export function DroppedToMeNotice() {
  const t = useTranslations("shops");
  const { ready, sellingAs, allShops } = useSellingIdentity();
  const last = useRef<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (sellingAs) {
      last.current = { id: sellingAs.id, name: sellingAs.name };
      selfSwitch.current = false;
      return;
    }
    const prev = last.current;
    if (!prev) return;
    if (!selfSwitch.current) {
      const still = allShops.find((s) => s.id === prev.id);
      toast.error(still && still.status !== "active" ? t("unavailableNotice", { shop: prev.name }) : t("removedNotice", { shop: prev.name }));
    }
    last.current = null;
    selfSwitch.current = false;
  }, [ready, sellingAs, allShops, t]);

  return null;
}
