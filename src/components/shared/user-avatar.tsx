import { RemoteImage } from "./remote-image";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * Round avatar. A fixed-size, overflow-hidden round container holds a `fill`
 * image (object-cover) — so it stays a perfect circle regardless of the source
 * image's aspect ratio (and immune to Tailwind preflight's `img { height: auto }`).
 * Falls back to initials. Never hand-roll avatar markup — use this.
 */
export function UserAvatar({
  name,
  avatarUrl,
  size = 40,
  className,
}: UserAvatarProps) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 align-middle",
        className,
      )}
    >
      {avatarUrl ? (
        <RemoteImage
          src={avatarUrl}
          alt={name}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <span
          className="font-semibold leading-none text-primary"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
