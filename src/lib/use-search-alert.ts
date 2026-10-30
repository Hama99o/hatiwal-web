"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { describeApiError } from "@/lib/api/error-codes";
import {
  createSavedSearch,
  setSavedSearchAlert,
  type SavedSearch,
  type SavedSearchInput,
} from "@/lib/api/saved-searches";

/**
 * Saved-search alerts: follow / unfollow, shared by the results banner and the
 * bell on each saved search. A saved row is toggled in place; the banner's
 * search, not saved yet, is saved WITH the alert on in one request. The list is
 * updated optimistically and re-synced; a refusal (the 5-follow limit) says why.
 */
export function useSearchAlert() {
  const t = useTranslations();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ saved, criteria, alert }: { saved?: SavedSearch; criteria?: SavedSearchInput; alert: boolean }) =>
      saved ? setSavedSearchAlert(saved.id, alert) : createSavedSearch({ ...criteria, alert }),
    onMutate: async ({ saved, alert }) => {
      if (!saved) return;
      await qc.cancelQueries({ queryKey: ["saved-searches"] });
      qc.setQueryData<SavedSearch[]>(["saved-searches"], (prev) =>
        prev?.map((s) => (s.id === saved.id ? { ...s, alert } : s)),
      );
    },
    onSuccess: (_data, { alert }) => {
      toast.success(t(alert ? "browse.alerts.on" : "browse.alerts.off"));
    },
    onError: (error) => toast.error(describeApiError(error, t)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}
