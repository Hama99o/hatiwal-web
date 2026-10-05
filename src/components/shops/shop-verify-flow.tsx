"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Check, ChevronRight, Hourglass, Pencil, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LockLine, PhotoStep, StepTitle } from "@/components/verify/verify-flow";
import { ApiError } from "@/lib/api/client";
import { getMyShop } from "@/lib/api/shops";
import { applyForShopVerification, normalizeDocumentNumber, shopVerificationQK, SHOP_DOCUMENT_TYPES, type ShopDocumentType } from "@/lib/api/verification";
import { cn } from "@/lib/utils";

/**
 * SHOP-1 "Applying for Verified shop" on the web — the same steps as mobile:
 * why → shop-front photo → licence or ID (+ optional number) → a phone we can
 * call → check and send → under review. Photos stay in memory only.
 */
type Step = "why" | "front" | "document" | "phone" | "review";
const STEPS: Step[] = ["why", "front", "document", "phone", "review"];

export function ShopVerifyFlow({ shopId }: { shopId: number }) {
  const t = useTranslations("verify");
  const router = useRouter();
  const qc = useQueryClient();
  const { data: shop } = useQuery({ queryKey: ["shop", shopId], queryFn: () => getMyShop(shopId) });
  const [step, setStep] = useState<Step>("why");
  const [front, setFront] = useState<Blob | null>(null);
  const [doc, setDoc] = useState<Blob | null>(null);
  const [docType, setDocType] = useState<ShopDocumentType>("licence");
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (shop?.phone && !phone) setPhone(shop.phone);
  }, [shop?.phone, phone]);

  const index = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  const back = () => (index > 0 ? setStep(STEPS[index - 1]) : router.push(`/shops/${shopId}`));
  const phoneOk = phone.trim().length >= 6 && phone.trim().length <= 30;

  const submit = useMutation({
    mutationFn: () =>
      applyForShopVerification({ shopId, documentType: docType, documentNumber: number || undefined, phone, shopFront: front as Blob, document: doc as Blob }),
    retry: (count, err) => count < 2 && !(err instanceof ApiError),
    onMutate: () => setErrorKey(null),
    onSuccess: (status) => {
      qc.setQueryData(shopVerificationQK(shopId), status);
      setFront(null);
      setDoc(null);
      setDone(true);
    },
    onError: (err) => {
      setErrorKey(err instanceof ApiError && err.status === 429 ? "review.tooMany" : err instanceof ApiError && err.code === "verification_already_requested" ? "review.alreadyRequested" : "review.failed");
    },
  });

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-16 text-center" data-testid="shop-verify-under-review">
        <Hourglass className="mx-auto size-12 text-warning" />
        <h1 className="text-2xl font-extrabold">{t("done.title")}</h1>
        <p className="text-muted-foreground">{t("done.body")}</p>
        <Button asChild className="w-full" data-testid="shop-verify-done">
          <Link href={`/shops/${shopId}`}>{t("done.close")}</Link>
        </Button>
      </div>
    );
  }

  const docLabel = (type: ShopDocumentType) => (type === "licence" ? t("shop.licence") : t(`document.types.${type}`));
  let content: React.ReactNode = null;
  let showContinue = true;
  let canContinue = true;
  switch (step) {
    case "why":
      content = (
        <div className="space-y-5">
          <BadgeCheck className="mx-auto size-14 text-primary" />
          <StepTitle title={t("shop.whyTitle")} />
          <ul className="space-y-3">
            {(["benefitTrust", "benefitBadge"] as const).map((k) => (
              <li key={k} className="flex items-center gap-2.5">
                <Check className="size-5 text-success" /> {t(`shop.${k}`)}
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-muted p-4 text-sm">{t("shop.need")}</p>
        </div>
      );
      break;
    case "front":
      showContinue = false;
      content = (
        <div className="space-y-4">
          <StepTitle title={t("shop.frontTitle")} subtitle={t("shop.frontSubtitle")} />
          <PhotoStep key="front" kind="front" file={front} onPicked={setFront} onUse={next} />
          <LockLine />
        </div>
      );
      break;
    case "document":
      showContinue = !!doc;
      content = (
        <div className="space-y-4">
          <StepTitle title={t("shop.docTitle")} subtitle={t("shop.docSubtitle")} />
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {SHOP_DOCUMENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={docType === type}
                onClick={() => setDocType(type)}
                data-testid={`shop-verify-doc-${type}`}
                className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-accent", docType === type && "border-2 border-primary")}
              >
                {docLabel(type)}
              </button>
            ))}
          </div>
          <PhotoStep key="document" kind="back" file={doc} onPicked={setDoc} onUse={next} />
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">{t("shop.numberLabel")}</span>
            <Input
              value={number}
              autoComplete="off"
              onChange={(e) =>
                setNumber(docType === "licence" ? e.target.value.toUpperCase().replace(/[^0-9A-Z\- /]/g, "").slice(0, 40) : normalizeDocumentNumber(e.target.value))
              }
              data-testid="shop-verify-number-input"
            />
            <span className="block text-xs text-muted-foreground">{t("name.numberHint")}</span>
          </label>
          <LockLine />
        </div>
      );
      break;
    case "phone":
      canContinue = phoneOk;
      content = (
        <div className="space-y-4">
          <StepTitle title={t("shop.phoneTitle")} subtitle={t("shop.phoneSubtitle")} />
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">{t("shop.phoneLabel")}</span>
            <Input type="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} data-testid="shop-verify-phone-input" />
            {phone.length > 0 && !phoneOk && <span className="block text-sm text-destructive">{t("shop.phoneError")}</span>}
          </label>
        </div>
      );
      break;
    case "review": {
      showContinue = false;
      const block = (key: string, label: string, value: string, target: Step) => (
        <div key={key} className="space-y-1 rounded-xl border bg-card p-3.5" data-testid={`shop-verify-review-${key}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <button type="button" onClick={() => setStep(target)} aria-label={t("review.edit")}>
              <Pencil className="size-4 text-primary" />
            </button>
          </div>
          <p className="font-semibold">{value}</p>
        </div>
      );
      content = (
        <div className="space-y-3">
          <StepTitle title={t("review.title")} subtitle={t("review.subtitle")} />
          {block("photos", t("review.photos"), "2", "front")}
          {block("document", t("review.document"), `${docLabel(docType)}${number ? ` · ••••${number.slice(-4)}` : ""}`, "document")}
          {block("phone", t("shop.phoneLabel"), phone, "phone")}
          <LockLine />
          {errorKey && <p className="text-sm text-destructive" role="alert">{t(errorKey)}</p>}
          <Button className="w-full" disabled={submit.isPending || !front || !doc || !phoneOk} onClick={() => submit.mutate()} data-testid="shop-verify-submit">
            {submit.isPending ? t("photo.sendingPlain") : errorKey ? t("tryAgain") : t("review.submit")}
          </Button>
        </div>
      );
      break;
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <button type="button" onClick={back} aria-label={t("steps.back")} data-testid="shop-verify-back">
            <ArrowLeft className="size-5 rtl:-scale-x-100" />
          </button>
          <span className="text-sm text-muted-foreground" data-testid="shop-verify-progress-label">
            {t("steps.progress", { step: index + 1, total: STEPS.length })}
          </span>
          <Link href={`/shops/${shopId}`} aria-label={t("steps.close")} data-testid="shop-verify-close">
            <X className="size-5" />
          </Link>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={index + 1}>
          <div className="h-full bg-primary" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>
      {content}
      {showContinue && (
        <Button className="mt-8 w-full" onClick={next} disabled={!canContinue} data-testid="shop-verify-next">
          {step === "why" ? t("why.start") : t("steps.next")}
          <ChevronRight className="size-4 rtl:-scale-x-100" />
        </Button>
      )}
    </div>
  );
}
