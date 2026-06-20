import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/layout/logo";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerText: string;
  footerLinkLabel: string;
  footerHref: string;
}

/** Shared shell for the login & signup pages (avoids duplicating the layout). */
export function AuthCard({
  title,
  subtitle,
  children,
  footerText,
  footerLinkLabel,
  footerHref,
}: AuthCardProps) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {children}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {footerText}{" "}
        <Link href={footerHref} className="font-medium text-primary hover:underline">
          {footerLinkLabel}
        </Link>
      </p>
    </div>
  );
}
