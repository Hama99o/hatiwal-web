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
  /**
   * Keep room at the END of the field for an action the HOST pins there
   * (search by image's 📷, see SearchBox): the text stops short of it and the
   * clear button moves to its start side.
   */
  reserveTrailing?: boolean;
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
  reserveTrailing = false,
  ...props
}: SearchFieldProps) {
  const t = useTranslations("common");
  const clearable = Boolean(onClear) && String(props.value ?? "") !== "";

  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
      <Input
        className={cn(
          "rounded-full border-transparent bg-surface ps-10 shadow-none hover:border-border focus-visible:bg-background",
          (clearable || reserveTrailing) && "pe-11",
          clearable && reserveTrailing && "pe-20",
          className,
        )}
        {...props}
      />
      {clearable && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClear}
          aria-label={t("clear")}
          className={cn(
            "absolute top-1/2 size-10 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground",
            reserveTrailing ? "end-9" : "end-0",
          )}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
