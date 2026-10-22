import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * The frame of a public guide (/how-to-sell, /buy-safely; docs/SEO.md): the
 * same brand band as /download, one column sized for reading on a phone, a
 * primary action, and a "keep reading" block of internal links so every guide
 * leads to the Bazaar, the other guide and the city pages.
 */
export function GuidePage({
  title,
  intro,
  cta,
  relatedTitle,
  related,
  children,
  testId,
}: {
  title: string;
  intro: string;
  cta: { href: string; label: string };
  relatedTitle: string;
  related: { href: string; label: string }[];
  children: ReactNode;
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <div className="border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
          <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-pretty text-lg text-muted-foreground">{intro}</p>
          <Button asChild className="mt-6">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-10 px-4 py-10">
        {children}
        <nav aria-labelledby="guide-related" className="rounded-xl border bg-card p-5">
          <h2 id="guide-related" className="text-lg font-semibold">
            {relatedTitle}
          </h2>
          <ul className="mt-2 divide-y">
            {related.map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {r.label}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

/** A titled section of a guide. */
export function GuideSection({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id}>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

/** Steps in order (an <ol>), each with an icon, like the /download "find, chat, meet" list. */
export function GuideSteps({
  steps,
}: {
  steps: { icon: LucideIcon; title: string; body: string }[];
}) {
  return (
    <ol className="space-y-5">
      {steps.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
