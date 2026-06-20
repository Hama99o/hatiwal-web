import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchFieldProps = React.ComponentProps<typeof Input> & {
  containerClassName?: string;
};

/**
 * Text input with a leading search icon. The single source for the search field
 * used by the site header and the browse island — callers supply their own
 * <form> + submit/onChange behavior.
 */
export function SearchField({
  containerClassName,
  className,
  ...props
}: SearchFieldProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn("ps-9", className)} {...props} />
    </div>
  );
}
