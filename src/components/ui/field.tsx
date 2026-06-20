import { cn } from "@/lib/utils";

interface FieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/** Form row: label + control + inline error. Reused across all forms. */
export function Field({ label, htmlFor, error, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
