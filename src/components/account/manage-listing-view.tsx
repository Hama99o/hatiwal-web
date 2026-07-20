"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Eye,
  Loader2,
  MessageSquare,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  getMyListing,
  listingLifecycle,
  deleteMyListing,
  type LifecycleAction,
} from "@/lib/api/me";
import type { Transaction } from "@/lib/types";
import { SellBuyerDialog } from "./sell-buyer-dialog";
import { ReviewPromptDialog } from "@/components/shared/review-prompt-dialog";
import { ListingGallery } from "@/components/listing/listing-gallery";
import { ListingViewsChart } from "./listing-views-chart";
import { PriceTag } from "@/components/shared/price-tag";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConditionBadge } from "@/components/shared/condition-badge";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const LIFECYCLE: Record<
  LifecycleAction,
  { label: string; success: string; title: string; desc: string }
> = {
  publish: {
    label: "publish",
    success: "publishSuccess",
    title: "confirmPublish",
    desc: "confirmPublishDescription",
  },
  unpublish: {
    label: "unpublish",
    success: "unpublishSuccess",
    title: "confirmUnpublish",
    desc: "confirmUnpublishDescription",
  },
  reserve: {
    label: "markReserved",
    success: "reserveSuccess",
    title: "confirmReserve",
    desc: "confirmReserveDescription",
  },
  activate: {
    label: "activate",
    success: "activateSuccess",
    title: "confirmActivate",
    desc: "confirmActivateDescription",
  },
  sold: {
    label: "markSold",
    success: "markSoldSuccess",
    title: "confirmMarkSold",
    desc: "markSoldConfirm",
  },
  renew: {
    label: "renew",
    success: "renewSuccess",
    title: "confirmRenew",
    desc: "confirmRenewDescription",
  },
};

function actionsFor(
  status: string,
  expired: boolean,
): { primary?: LifecycleAction; secondary: LifecycleAction[] } {
  if (status === "draft") return { primary: "publish", secondary: [] };
  if (status === "reserved")
    return { primary: "sold", secondary: ["activate"] };
  if (status === "active" && expired)
    return { primary: "renew", secondary: ["sold"] };
  if (status === "active")
    return { primary: "sold", secondary: ["reserve", "unpublish", "renew"] };
  return { secondary: [] }; // sold
}

type Pending =
  | { kind: "lifecycle"; action: LifecycleAction }
  | { kind: "delete" }
  | null;

export function ManageListingView({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const {
    data: listing,
    isPending,
    isError,
    refetch,
  } = useQuery({ queryKey: ["my-listing", id], queryFn: () => getMyListing(id) });

  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  // After a sale with a buyer, prompt the seller to review them right away.
  const [reviewTxn, setReviewTxn] = useState<Transaction | null>(null);

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState icon={TriangleAlert} title={t("common.error")} />
      </div>
    );
  }

  const { primary, secondary } = actionsFor(listing.status, !!listing.expired);

  // reserve/sold use the buyer picker (records a Transaction); everything else
  // (publish/unpublish/activate/renew/delete) uses the plain confirm dialog.
  const buyerFlow =
    pending?.kind === "lifecycle" &&
    (pending.action === "reserve" || pending.action === "sold");

  async function performLifecycle(
    action: LifecycleAction,
    opts?: { buyerId?: number; finalPrice?: number },
  ) {
    const result = await listingLifecycle(listing!.id, action, opts);
    toast.success(t(`listing.${LIFECYCLE[action].success}`));
    qc.invalidateQueries({ queryKey: ["my-listings"] });
    refetch();
    return result;
  }

  // Confirm-dialog path: delete + non-buyer lifecycle actions.
  async function runPending() {
    if (!pending || !listing) return;
    setBusy(true);
    try {
      if (pending.kind === "delete") {
        await deleteMyListing(listing.id);
        toast.success(t("listing.deleteSuccess"));
        qc.invalidateQueries({ queryKey: ["my-listings"] });
        router.push("/my-listings");
        return;
      }
      await performLifecycle(pending.action);
      setPending(null);
      setBusy(false);
    } catch {
      toast.error(t("common.error"));
      setBusy(false);
    }
  }

  // Buyer-picker path: reserve/sold with an optional buyer + final price.
  async function submitSale(buyerId: number | null, finalPrice: number | null) {
    if (!pending || pending.kind !== "lifecycle" || !listing) return;
    const action = pending.action;
    setBusy(true);
    try {
      const { transaction } = await performLifecycle(action, {
        buyerId: buyerId ?? undefined,
        finalPrice: finalPrice ?? undefined,
      });
      setPending(null);
      setBusy(false);
      // Offer to review the buyer straight away when a sale recorded one.
      if (action === "sold" && transaction) setReviewTxn(transaction);
    } catch {
      toast.error(t("common.error"));
      setBusy(false);
    }
  }

  const dialog =
    pending?.kind === "delete"
      ? {
          title: t("listing.confirmDelete"),
          desc: t("listing.confirmDeleteDescription"),
          confirm: t("listing.delete"),
          destructive: true,
        }
      : pending
        ? {
            title: t(`listing.${LIFECYCLE[pending.action].title}`),
            desc: t(`listing.${LIFECYCLE[pending.action].desc}`),
            confirm: t(`listing.${LIFECYCLE[pending.action].label}`),
            destructive: false,
          }
        : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <ListingGallery images={listing.images} title={listing.title} />

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={listing.status} />
            <ExpiryBadge
              expiresAt={listing.expiresAt}
              expired={listing.expired}
            />
            {listing.condition && <ConditionBadge condition={listing.condition} />}
          </div>

          <div className="space-y-2">
            <PriceTag price={listing.price} currency={listing.currency} size="lg" />
            <h1 className="text-pretty text-xl font-bold sm:text-2xl">
              {listing.title}
            </h1>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-4" />
              {t("listing.viewsCount", { count: listing.viewsCount })}
            </span>
            <Link
              href={`/conversations?listing=${listing.id}`}
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              <MessageSquare className="size-4" />
              {t("listing.conversationsCount", {
                count: listing.conversationsCount ?? 0,
              })}
            </Link>
          </div>

          {/* Lifecycle actions */}
          <div className="space-y-2">
            {primary && (
              <Button
                className="w-full"
                onClick={() => setPending({ kind: "lifecycle", action: primary })}
              >
                {t(`listing.${LIFECYCLE[primary].label}`)}
              </Button>
            )}
            {secondary.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {secondary.map((a) => (
                  <Button
                    key={a}
                    variant="outline"
                    size="sm"
                    onClick={() => setPending({ kind: "lifecycle", action: a })}
                  >
                    {t(`listing.${LIFECYCLE[a].label}`)}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t pt-4">
            <Button asChild variant="secondary" className="flex-1">
              <Link href={`/listings/${listing.id}/edit`}>
                <Pencil className="size-4" />
                {t("common.edit")}
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setPending({ kind: "delete" })}
            >
              <Trash2 className="size-4" />
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </div>

      {listing.description && (
        <section className="mt-8 max-w-3xl">
          <h2 className="mb-2 text-lg font-semibold">
            {t("listing.detail.description")}
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
            {listing.description}
          </p>
        </section>
      )}

      <ListingViewsChart id={listing.id} />

      {dialog && !buyerFlow && (
        <ConfirmDialog
          open
          title={dialog.title}
          description={dialog.desc}
          confirmLabel={dialog.confirm}
          cancelLabel={t("common.cancel")}
          destructive={dialog.destructive}
          loading={busy}
          onConfirm={runPending}
          onCancel={() => !busy && setPending(null)}
        />
      )}

      {buyerFlow && pending?.kind === "lifecycle" && (
        <SellBuyerDialog
          action={pending.action as "reserve" | "sold"}
          listingId={listing.id}
          busy={busy}
          onCancel={() => !busy && setPending(null)}
          onConfirm={submitSale}
        />
      )}

      {reviewTxn && (
        <ReviewPromptDialog
          transaction={reviewTxn}
          // The caller here is always the seller (only the owner reserves/sells),
          // and the lifecycle payload's own `role` is null (serialized without a
          // current_user), so state it explicitly.
          role="seller"
          onClose={() => setReviewTxn(null)}
        />
      )}
    </div>
  );
}
