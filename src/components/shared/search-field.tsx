"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchFieldProps = React.ComponentProps<typeof Input> & {
  containerClassName?: string;
  /**
   * When provided, a clear (X) button appears at the end of the field while it
   * has text — a search box you can't empty in one tap is a dead end on a
   * phone. The caller resets its own state (and usually refocuses the field).
   */
  onClear?: () => void;
};

/**
 * Text input with a leading search icon and an optional trailing clear button.
 * The single source for the search field used by the site header and the browse
 * island (both via `SearchBox`) — callers supply their own onChange/submit.
 */
export function SearchField({
  containerClassName,
  className,
  onClear,
  ...props
}: SearchFieldProps) {
  const t = useTranslations("common");
  const clearable = Boolean(onClear) && String(props.value ?? "") !== "";

  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn("ps-9", clearable && "pe-11", className)} {...props} />
      {clearable && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClear}
          aria-label={t("clear")}
          className="absolute end-0 top-1/2 size-10 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
