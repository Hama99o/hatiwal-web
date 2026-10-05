"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  Crop,
  Droplets,
  Hourglass,
  IdCard,
  ImageUp,
  Lock,
  Pencil,
  ScanFace,
  Sun,
  X,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import {
  applyForVerification,
  clearVerificationDraft,
  VERIFICATION_DRAFT_KEY,
  normalizeLast4,
  MAX_VERIFICATION_PHOTO_BYTES,
  TWO_SIDED_DOCUMENTS,
  VERIFICATION_DOCUMENT_TYPES,
  VERIFICATION_QK,
  type VerificationDocumentType,
} from "@/lib/api/verification";
import { cn } from "@/lib/utils";

/**
 * VER-1 "Apply for Verified account" on the web — the same 9 steps as mobile
 * (docs/VERIFICATION.md), one question per screen with a progress bar.
 *
 * Progress is saved in this browser (step, document, name, last 4) so leaving
 * halfway resumes at the same place. The PHOTOS are deliberately kept in memory
 * only — an ID photo is never written to browser storage — so after a reload
 * the flow resumes at the first photo still missing.
 *
 * Photos: upload (on a phone `capture` opens the camera) or the webcam.
 * testids mirror mobile (maestro/verification/README.md).
 */
type Step = "why" | "document" | "ready" | "front" | "back" | "selfie" | "name" | "review";
type PhotoKey = "front" | "back" | "selfie";


interface SavedDraft {
  /** Whose draft this is: another account's draft is discarded unseen. */
  userId: number;
  step: Step;
  documentType: VerificationDocumentType | null;
  nameOnDocument: string;
  documentLast4: string;
}

function stepsFor(doc: VerificationDocumentType | null): Step[] {
  const s: Step[] = ["why", "document", "ready", "front"];
  if (doc && TWO_SIDED_DOCUMENTS.includes(doc)) s.push("back");
  s.push("selfie", "name", "review");
  return s;
}

const isValidLast4 = (v: string) => /^\d{4}$/.test(v);
const isValidName = (v: string) => v.trim().split(/\s+/).filter(Boolean).length >= 2;

function loadDraft(): SavedDraft | null {
  try {
    const raw = window.localStorage.getItem(VERIFICATION_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as SavedDraft) : null;
  } catch {
    return null;
  }
}
function saveDraft(d: SavedDraft) {
  try {
    window.localStorage.setItem(VERIFICATION_DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* private mode: progress just isn't remembered */
  }
}
const clearDraft = clearVerificationDraft;

function LockLine() {
  const t = useTranslations("verify");
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="size-3.5 shrink-0" />
      {t("onlyTeam")}
    </p>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1.5">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** A drawn ID card for the good / bad examples. */
function DocumentSketch({ variant, className }: { variant: "good" | "cropped" | "glare" | "blurry"; className?: string }) {
  return (
    <div className={cn("relative aspect-[1.58] overflow-hidden rounded-lg bg-muted", className)} aria-hidden>
      <div
        className={cn(
          "absolute top-[14%] flex h-[72%] w-[80%] gap-[5%] rounded-md border bg-card p-[5%]",
          variant === "cropped" ? "start-[38%]" : "start-[10%]",
          variant === "blurry" && "opacity-45 blur-[1.5px]",
        )}
      >
        <div className="h-full w-1/4 rounded bg-border" />
        <div className="flex flex-1 flex-col gap-[10%] pt-0.5">
          {[90, 70, 80, 50].map((w) => (
            <div key={w} className="h-1 rounded bg-border" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      {variant === "glare" && <div className="absolute start-[35%] top-[18%] h-[45%] w-[40%] rounded-full bg-white/85" />}
    </div>
  );
}

function PhotoStep({
  kind,
  file,
  onPicked,
  onUse,
}: {
  kind: PhotoKey;
  file: Blob | null;
  onPicked: (f: Blob | null) => void;
  onUse: () => void;
}) {
  const t = useTranslations("verify");
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  useEffect(() => () => stream?.getTracks().forEach((tr) => tr.stop()), [stream]);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.size > MAX_VERIFICATION_PHOTO_BYTES) {
      setError(t("photo.tooBig"));
      return;
    }
    onPicked(f);
  }

  async function openWebcam() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: kind === "selfie" ? "user" : "environment" },
        audio: false,
      });
      setStream(s);
    } catch {
      setError(t("photo.webcamFailed"));
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onPicked(blob);
        stream?.getTracks().forEach((tr) => tr.stop());
        setStream(null);
      },
      "image/jpeg",
      0.85,
    );
  }

  if (preview) {
    return (
      <div className="space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, never a remote image */}
        <img
          src={preview}
          alt=""
          data-testid="verify-photo-preview"
          className={cn("w-full rounded-xl bg-muted object-contain", kind === "selfie" ? "aspect-[3/4]" : "aspect-[1.58]")}
        />
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onPicked(null)} data-testid="verify-photo-retake">
            {t("photo.retake")}
          </Button>
          <Button className="flex-1" onClick={onUse} data-testid="verify-photo-use">
            {t("photo.use")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stream ? (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} autoPlay playsInline muted className={cn("w-full", kind === "selfie" && "-scale-x-100")} />
          <div
            className={cn(
              "pointer-events-none absolute inset-[10%] border-2 border-dashed border-white/80",
              kind === "selfie" ? "rounded-full" : "rounded-xl",
            )}
          />
        </div>
      ) : (
        <div
          data-testid="verify-photo-frame"
          className={cn(
            "mx-auto flex items-center justify-center border-2 border-dashed border-primary bg-muted",
            kind === "selfie" ? "h-60 w-48 rounded-full" : "aspect-[1.58] w-full max-w-sm rounded-2xl",
          )}
        >
          {kind === "selfie" ? <ScanFace className="size-14 text-muted-foreground" /> : <IdCard className="size-14 text-muted-foreground" />}
        </div>
      )}
      {kind === "selfie" && !stream && (
        <ul className="space-y-2">
          {(["tipFace", "tipLight", "tipHold"] as const).map((k) => (
            <li key={k} className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-success" />
              {t(`selfie.${k}`)}
            </li>
          ))}
        </ul>
      )}
      {stream ? (
        <Button className="w-full" onClick={capture} data-testid="verify-photo-capture">
          <Camera className="size-4" /> {t("photo.capture")}
        </Button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={() => inputRef.current?.click()} data-testid="verify-photo-gallery">
            <ImageUp className="size-4" /> {t("photo.upload")}
          </Button>
          <Button variant="outline" onClick={openWebcam} data-testid="verify-photo-camera">
            <Camera className="size-4" /> {t("photo.webcam")}
          </Button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={kind === "selfie" ? "user" : "environment"}
        className="sr-only"
        tabIndex={-1}
        data-testid="verify-photo-input"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function VerifyFlow() {
  const t = useTranslations("verify");
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("why");
  const [documentType, setDocumentType] = useState<VerificationDocumentType | null>(null);
  const [nameOnDocument, setName] = useState("");
  const [documentLast4, setLast4] = useState("");
  const [photos, setPhotos] = useState<Record<PhotoKey, Blob | null>>({ front: null, back: null, selfie: null });
  const [touchedName, setTouchedName] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [restored, setRestored] = useState(false);

  // Resume saved progress once the account is known, on the client. Photos are
  // not saved, so a resumed draft goes back to the first photo still missing.
  // A draft that belongs to another account (shared computer) is thrown away.
  useEffect(() => {
    if (!user || restored) return;
    const d = loadDraft();
    if (d && d.userId === user.id) {
      setDocumentType(d.documentType);
      setName(d.nameOnDocument);
      setLast4(d.documentLast4);
      const order = stepsFor(d.documentType);
      const photoIdx = order.indexOf("front");
      const at = order.indexOf(d.step);
      setStep(at > photoIdx ? "front" : d.step);
    } else if (d) {
      clearDraft();
    }
    setRestored(true);
  }, [user, restored]);

  useEffect(() => {
    if (restored && !done && user) saveDraft({ userId: user.id, step, documentType, nameOnDocument, documentLast4 });
  }, [restored, done, user, step, documentType, nameOnDocument, documentLast4]);

  useEffect(() => {
    if (step === "name" && !nameOnDocument && user?.fullName) setName(user.fullName);
  }, [step, nameOnDocument, user?.fullName]);

  const steps = stepsFor(documentType);
  const current: Step = steps.includes(step) ? step : "why";
  const index = steps.indexOf(current);
  const twoSided = !!documentType && TWO_SIDED_DOCUMENTS.includes(documentType);

  const next = () => setStep(steps[Math.min(index + 1, steps.length - 1)]);
  const back = () => (index > 0 ? setStep(steps[index - 1]) : router.push("/profile"));

  const complete =
    !!documentType && !!photos.front && !!photos.selfie && (!twoSided || !!photos.back) && isValidName(nameOnDocument) && isValidLast4(documentLast4);

  const submit = useMutation({
    mutationFn: () =>
      applyForVerification({
        documentType: documentType as VerificationDocumentType,
        nameOnDocument,
        documentLast4,
        front: photos.front as Blob,
        back: twoSided ? photos.back : null,
        selfie: photos.selfie as Blob,
      }),
    retry: (count, err) => count < 2 && !(err instanceof ApiError),
    onMutate: () => setErrorKey(null),
    onSuccess: (status) => {
      qc.setQueryData(VERIFICATION_QK, status);
      clearDraft();
      setPhotos({ front: null, back: null, selfie: null });
      setDone(true);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) setErrorKey("review.tooMany");
      else if (err instanceof ApiError && err.code === "verification_already_requested") setErrorKey("review.alreadyRequested");
      else setErrorKey("review.failed");
      qc.invalidateQueries({ queryKey: VERIFICATION_QK });
    },
  });

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-16 text-center" data-testid="verify-under-review">
        <div className="mx-auto flex size-22 items-center justify-center rounded-full bg-warning/15">
          <Hourglass className="size-10 text-warning" />
        </div>
        <h1 className="text-2xl font-extrabold">{t("done.title")}</h1>
        <p className="text-muted-foreground">{t("done.body")}</p>
        <Button asChild className="w-full" data-testid="verify-done-close">
          <Link href="/profile">{t("done.close")}</Link>
        </Button>
      </div>
    );
  }

  let content: React.ReactNode = null;
  let canContinue = true;
  let showContinue = true;

  switch (current) {
    case "why":
      content = (
        <div className="space-y-5">
          <BadgeCheck className="mx-auto size-16 text-primary" />
          <StepTitle title={t("why.title")} subtitle={t("why.subtitle")} />
          <ul className="space-y-3">
            {(["trust", "faster", "name"] as const).map((k) => (
              <li key={k} className="flex items-center gap-2.5">
                <Check className="size-5 text-success" />
                {t(`benefits.${k}`)}
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-muted p-4 text-sm">{t("why.need")}</p>
        </div>
      );
      break;

    case "document":
      canContinue = !!documentType;
      content = (
        <div className="space-y-4">
          <StepTitle title={t("document.title")} subtitle={t("document.subtitle")} />
          <div role="radiogroup" className="space-y-3">
            {VERIFICATION_DOCUMENT_TYPES.map((type) => {
              const selected = documentType === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`verify-doc-${type}`}
                  onClick={() => {
                    setDocumentType(type);
                    if (!TWO_SIDED_DOCUMENTS.includes(type)) setPhotos((p) => ({ ...p, back: null }));
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-start transition-colors hover:bg-accent",
                    selected && "border-2 border-primary",
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <IdCard className={cn("size-5", selected ? "text-primary" : "text-muted-foreground")} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">{t(`document.types.${type}`)}</span>
                    <span className="block text-sm text-muted-foreground">{t(`document.hints.${type}`)}</span>
                  </span>
                  {selected && <Check className="size-5 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      );
      break;

    case "ready":
      content = (
        <div className="space-y-4">
          <StepTitle title={t("ready.title")} subtitle={t("ready.subtitle")} />
          <div className="space-y-2 rounded-xl border-2 border-success p-4 text-center">
            <DocumentSketch variant="good" className="mx-auto w-56" />
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold">
              <Check className="size-4 text-success" /> {t("ready.good")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["cropped", Crop],
                ["glare", Sun],
                ["blurry", Droplets],
              ] as const
            ).map(([k, Icon]) => (
              <div key={k} className="space-y-1.5 rounded-xl border border-destructive p-2 text-center">
                <DocumentSketch variant={k} />
                <p className="flex items-center justify-center gap-1 text-sm font-semibold">
                  <X className="size-3.5 text-destructive" />
                  <Icon className="size-3.5 text-muted-foreground" />
                  {t(`ready.${k}`)}
                </p>
              </div>
            ))}
          </div>
          <LockLine />
        </div>
      );
      break;

    case "front":
    case "back":
    case "selfie":
      showContinue = false;
      content = (
        <div className="space-y-4">
          <StepTitle title={t(`${current}.title`)} subtitle={t(`${current}.subtitle`)} />
          <PhotoStep
            key={current}
            kind={current}
            file={photos[current]}
            onPicked={(f) => setPhotos((p) => ({ ...p, [current]: f }))}
            onUse={next}
          />
          <LockLine />
        </div>
      );
      break;

    case "name": {
      const last4Error = documentLast4.length > 0 && !isValidLast4(documentLast4);
      const nameError = touchedName && !isValidName(nameOnDocument);
      canContinue = isValidName(nameOnDocument) && isValidLast4(documentLast4);
      content = (
        <div className="space-y-4">
          <StepTitle title={t("name.title")} subtitle={t("name.subtitle")} />
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">{t("name.nameLabel")}</span>
            <Input
              value={nameOnDocument}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouchedName(true)}
              autoComplete="name"
              dir="auto"
              data-testid="verify-name-input"
              aria-invalid={nameError || undefined}
            />
            {nameError && <span className="block text-sm text-destructive">{t("name.nameError")}</span>}
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">{t("name.last4Label")}</span>
            <Input
              value={documentLast4}
              onChange={(e) => setLast4(normalizeLast4(e.target.value))}
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              autoComplete="off"
              data-testid="verify-last4-input"
              aria-invalid={last4Error || undefined}
            />
            {last4Error ? (
              <span className="block text-sm text-destructive" data-testid="verify-last4-error">
                {t("name.last4Error")}
              </span>
            ) : (
              <span className="block text-xs text-muted-foreground">{t("name.last4Hint")}</span>
            )}
          </label>
          <LockLine />
        </div>
      );
      break;
    }

    case "review": {
      showContinue = false;
      const shown = [photos.front, twoSided ? photos.back : null, photos.selfie].filter(Boolean) as Blob[];
      const block = (label: string, value: React.ReactNode, target: Step, id: string) => (
        <div key={id} className="space-y-2 rounded-xl border bg-card p-3.5" data-testid={`verify-review-${id}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                <Check className="size-3" /> {t("review.ready")}
              </span>
              <button type="button" onClick={() => setStep(target)} aria-label={t("review.edit")} data-testid={`verify-edit-${id}`}>
                <Pencil className="size-4 text-primary" />
              </button>
            </span>
          </div>
          {value}
        </div>
      );
      content = (
        <div className="space-y-3">
          <StepTitle title={t("review.title")} subtitle={t("review.subtitle")} />
          {block(
            t("review.document"),
            <p className="font-semibold">
              {documentType ? t(`document.types.${documentType}`) : ""} · ••••{documentLast4}
            </p>,
            "document",
            "document",
          )}
          {block(
            t("review.photos"),
            <div className="flex gap-2">
              {shown.map((b, i) => (
                <ReviewThumb key={i} blob={b} />
              ))}
            </div>,
            "front",
            "photos",
          )}
          {block(t("review.name"), <p className="font-semibold" dir="auto">{nameOnDocument}</p>, "name", "name")}
          <LockLine />
          {errorKey && (
            <p className="text-sm text-destructive" role="alert" data-testid="verify-submit-error">
              {t(errorKey)}
            </p>
          )}
          <Button className="w-full" onClick={() => submit.mutate()} disabled={submit.isPending || !complete} data-testid="verify-submit">
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
          <button type="button" onClick={back} aria-label={t("steps.back")} data-testid="verify-back">
            <ArrowLeft className="size-5 rtl:-scale-x-100" />
          </button>
          <span className="text-sm text-muted-foreground" data-testid="verify-progress-label">
            {t("steps.progress", { step: index + 1, total: steps.length })}
          </span>
          <Link href="/profile" aria-label={t("steps.close")} data-testid="verify-close">
            <X className="size-5" />
          </Link>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      {content}

      {showContinue && (
        <Button className="mt-8 w-full" onClick={next} disabled={!canContinue} data-testid="verify-next">
          {current === "why" ? t("why.start") : t("steps.next")}
          <ChevronRight className="size-4 rtl:-scale-x-100" />
        </Button>
      )}
    </div>
  );
}

function ReviewThumb({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, never a remote image
  return <img src={url} alt="" className="size-18 rounded-lg bg-muted object-cover" />;
}
