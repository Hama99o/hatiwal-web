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
   * to the person instead of floating under the whole avatar row. Ignored when
   * `href` is set to something interactive — keep `meta` non-interactive then.
   */
  meta?: ReactNode;
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
        <span className="flex items-center gap-1">
          <span className="truncate font-semibold text-foreground">{name}</span>
          {verified && <VerifiedBadge />}
        </span>
        {subtitle && (
          <span className="truncate text-sm text-muted-foreground">
            {subtitle}
          </span>
        )}
        {meta && <div className="mt-1">{meta}</div>}
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
