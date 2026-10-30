"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  reportSuggestionOutcome,
  suggestCategory,
  SUGGESTION_PHOTO_SIDE,
} from "@/lib/api/category-suggestion";
import { shrinkPhoto } from "@/lib/image-search/shrink-photo";
import { useServerFeatures } from "@/lib/server-features";
import type { Category } from "@/lib/types";
import { shouldAskForSuggestion, suggestedCategory, type SuggestionAnswer } from "./rules";

/**
 * Sell with a photo (hatiwal-mobile docs/design/SELL_WITH_PHOTO.md): asks once
 * for the first photo of a new listing, in the background, and says which
 * category to offer now (rules.ts). Every failure is silent: the suggestion is
 * a bonus, never a step.
 */
export function useCategorySuggestion({
  isEdit,
  firstPhoto,
  photoKeys,
  categoryId,
  categories,
  onAccept,
}: {
  isEdit: boolean;
  firstPhoto: { key: string; file: File } | null;
  photoKeys: string[];
  categoryId: string;
  categories: Category[];
  onAccept: (categoryId: number) => void;
}) {
  const enabled = useServerFeatures().categorySuggestion === true;
  const [answer, setAnswer] = useState<SuggestionAnswer | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const askedRef = useRef(false);

  const { mutate } = useMutation({
    mutationFn: async (photo: { key: string; file: File }) => {
      const small = await shrinkPhoto(photo.file, SUGGESTION_PHOTO_SIDE);
      const result = await suggestCategory(small, photo.file.name || "photo.jpg");
      return result ? { ...result, photoKey: photo.key } : null;
    },
    onSuccess: (result) => setAnswer(result),
    retry: false,
  });

  useEffect(() => {
    if (!firstPhoto) return;
    const ask = shouldAskForSuggestion({
      isEdit,
      enabled,
      online: typeof navigator === "undefined" || navigator.onLine,
      alreadyAsked: askedRef.current,
      photoCount: photoKeys.length,
      categoryId,
    });
    if (!ask) return;
    askedRef.current = true;
    mutate(firstPhoto);
  }, [firstPhoto, isEdit, enabled, photoKeys.length, categoryId, mutate]);

  const shown = suggestedCategory({ answer, categoryId, dismissed, photoKeys, categories });

  // The seller picked a category in the field while the chip showed: it leaves
  // for good. The suggested one (from the picker's "Suggested" row) counts as
  // accepted; another one is "replaced" — the honest miss, for tuning.
  const wasShown = useRef(false);
  useEffect(() => {
    if (wasShown.current && !shown && answer && !dismissed && categoryId) {
      setDismissed(true);
      reportSuggestionOutcome(categoryId === String(answer.categoryId) ? "accepted" : "replaced", answer);
    }
    wasShown.current = shown !== null;
  }, [shown, answer, dismissed, categoryId]);

  const accept = useCallback(() => {
    if (!answer) return;
    wasShown.current = false;
    setDismissed(true);
    onAccept(answer.categoryId);
    reportSuggestionOutcome("accepted", answer);
  }, [answer, onAccept]);

  const dismiss = useCallback(() => {
    if (!answer) return;
    wasShown.current = false;
    setDismissed(true);
    reportSuggestionOutcome("dismissed", answer);
  }, [answer]);

  return { shown, accept, dismiss };
}
