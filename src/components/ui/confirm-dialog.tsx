"use client";

import type * as React from "react";
import { useId } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /**
   * Body copy. A node (not just a string) so a caller can add the subject it is
   * acting on — e.g. the listing's title under the question, which is what makes
   * the prompt unambiguous when it opens over a grid of cards.
   */
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * THE confirm prompt — the web analogue of mobile's `confirmAlert`, used instead
 * of window.confirm for every destructive/lifecycle action (publish, mark sold,
 * renew, unpublish, delete a listing, leave a chat, delete an account).
 *
 * Composes the shared `Dialog` primitive rather than re-rolling a scrim: that is
 * where Escape-to-close, focus-on-open, the Tab focus-trap, body scroll-lock and
 * focus-restore live. `loading` blocks dismissal so the prompt can't be closed
 * mid-request.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      labelledBy={titleId}
      dismissible={!loading}
      className="max-w-sm"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
