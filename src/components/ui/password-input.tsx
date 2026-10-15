"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "./input";
import { cn } from "@/lib/utils";

/**
 * A password field with a show / hide toggle (web UI/UX QA #28; Etsy, Airbnb).
 * Typing a password blind on a phone keyboard is where sign-ups fail. The
 * toggle is a real button (named, `aria-pressed`, 44px) at the inline END of
 * the field, so it sits on the left in ps / fa / ur. It never submits the form,
 * and it stays in the tab order right after the field.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => {
  const t = useTranslations("auth");
  const [visible, setVisible] = React.useState(false);
  const label = visible ? t("hidePassword") : t("showPassword");
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        // The value is a password either way: no autocorrect / capitalisation
        // while it is shown as text.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("pe-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        title={label}
        aria-pressed={visible}
        aria-controls={props.id}
        data-testid="password-toggle"
        className="absolute end-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
