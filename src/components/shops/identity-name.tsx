import { textDir } from "@/lib/text-direction";
import { cn } from "@/lib/utils";

/**
 * A sell-as identity's name in a row: "Me · Umair Shopkeeper" or a shop name.
 *
 * The name is its own bidi isolate in its OWN direction (web UI/UX QA #26).
 * As one string, a Latin name inside an RTL row was laid out by the RTL row and
 * the ellipsis ate its START: "…air Shopkeeper · خودم". Isolated, a Latin name
 * keeps its first letters and loses its end, an Arabic-script one likewise, and
 * the "Me ·" label never truncates.
 */
export function IdentityName({
  name,
  prefix,
  className,
}: {
  name: string;
  /** The translated "Me" for the personal identity; none for a shop. */
  prefix?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 flex-1 items-center", className)}>
      {prefix && <span className="shrink-0 whitespace-pre">{`${prefix} · `}</span>}
      <bdi dir={textDir(name)} className="block min-w-0 truncate text-start">
        {name}
      </bdi>
    </span>
  );
}
