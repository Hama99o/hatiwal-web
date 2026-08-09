import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { UserAvatar } from "./user-avatar";
import { VerifiedBadge } from "./verified-badge";
import { cn } from "@/lib/utils";

interface UserIdentityProps {
  name: string;
  avatarUrl?: string | null;
  verified?: boolean;
  subtitle?: string | null;
  size?: number;
  layout?: "row" | "stacked";
  /**
   * Extra trust line rendered inside the text column, directly under the
   * name/subtitle (e.g. a `RatingDisplay`). Keeps the badge visually attached
   * to the person instead of floating under the whole avatar row.
   *
   * **Not rendered when `href` is set** — the whole identity is then a single
   * `<a>`, and `meta` is typically a link itself (nested anchors are invalid
   * HTML and throw a hydration error). Put the meta outside the identity in
   * that case.
   */
  meta?: ReactNode;
  /**
   * Heading level for the name. A person's name is the `h1` of their own
   * profile page (`/profile`, `/sellers/[id]`); everywhere else the identity is
   * inline in a card/header, so it stays a plain `span`. Styling is identical —
   * only the semantics (and the document outline) change.
   */
  nameAs?: "span" | "h1" | "h2" | "h3";
  /** Locale-aware href; when set the whole identity becomes a link. */
  href?: string;
  className?: string;
}

/**
 * Canonical "show a person" unit: avatar + name + verified (+ optional subtitle).
 * Never assemble these pieces ad hoc — extend this component instead.
 */
export function UserIdentity({
  name,
  avatarUrl,
  verified,
  subtitle,
  size = 40,
  layout = "row",
  meta,
  nameAs: NameTag = "span",
  href,
  className,
}: UserIdentityProps) {
  const body = (
    <div
      className={cn(
        "flex items-center gap-3",
        layout === "stacked" && "flex-col gap-2 text-center",
        className,
      )}
    >
      <UserAvatar name={name} avatarUrl={avatarUrl} size={size} />
      <div
        className={cn(
          "min-w-0",
          layout === "stacked" && "flex flex-col items-center",
        )}
      >
        {/* div, not span: `nameAs` may be a heading, which is flow content and
            cannot legally live inside a phrasing-content span. */}
        <div className="flex items-center gap-1">
          <NameTag className="truncate font-semibold text-foreground">
            {name}
          </NameTag>
          {verified && <VerifiedBadge />}
        </div>
        {subtitle && (
          <span className="truncate text-sm text-muted-foreground">
            {subtitle}
          </span>
        )}
        {/* `!href`: see the prop docs — an <a> inside the identity's own <a>
            is invalid HTML and a hydration error, so meta is dropped rather
            than silently nested. */}
        {meta && !href && <div className="mt-1">{meta}</div>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="transition-opacity hover:opacity-80">
        {body}
      </Link>
    );
  }
  return body;
}
