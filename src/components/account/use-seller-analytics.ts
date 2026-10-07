"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/error-codes";
import { getSellerAnalytics, relaunchExpired, sellerAnalyticsKey } from "@/lib/api/analytics";

/** The numbers of one identity (null = Me), plus "Relaunch all" for its expired listings. */
export function useSellerAnalytics(shopId: number | null, enabled = true) {
  const t = useTranslations();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: sellerAnalyticsKey(shopId),
    queryFn: () => getSellerAnalytics(shopId),
    enabled,
  });
  const relaunchAll = useMutation({
    mutationFn: () => relaunchExpired(shopId),
    onSuccess: ({ renewed }) => {
      qc.invalidateQueries({ queryKey: sellerAnalyticsKey(shopId) });
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      toast.success(t("seller.analytics.relaunchedAll", { count: renewed }));
    },
    onError: (error) => toast.error(apiErrorMessage(error, t) ?? t("common.error")),
  });
  return { ...query, relaunchAll };
}
