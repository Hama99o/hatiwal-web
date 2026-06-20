import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ShoppingBag className="size-5" />
      </span>
      <span className="text-lg font-bold tracking-tight text-foreground">
        Hatiwal
      </span>
    </span>
  );
}
