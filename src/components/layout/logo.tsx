import { cn } from "@/lib/utils";

// The Hatiwal logo mark — a gold shopping bag with the lapis "H" (same Lato
// Black letterform as the app icon). Brand colors are intentionally fixed: a
// logo renders its own colors, independent of the UI theme. Gradient ids are
// constant — duplicate instances on a page are identical, so they resolve fine.
function HMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="hatiwalLap" cx="32%" cy="24%" r="90%">
          <stop offset="0%" stopColor="#3A63D6" />
          <stop offset="100%" stopColor="#102049" />
        </radialGradient>
        <linearGradient id="hatiwalAu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7D680" />
          <stop offset="100%" stopColor="#C49228" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="18" fill="url(#hatiwalLap)" />
      <rect x="35" y="30" width="14" height="24" rx="7" fill="none" stroke="url(#hatiwalAu)" strokeWidth={4.2} />
      <rect x="51" y="30" width="14" height="24" rx="7" fill="none" stroke="url(#hatiwalAu)" strokeWidth={4.2} />
      <polygon points="29,44 71,44 75,82 25,82" fill="url(#hatiwalAu)" />
      <path
        d="M62.22 51V79H55.69V67.16H44.31V79H37.78V51H44.31V62.71H55.69V51Z"
        fill="#102049"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <HMark className="size-8" />
      <span className="text-lg font-bold tracking-tight text-foreground">
        Hatiwal
      </span>
    </span>
  );
}
