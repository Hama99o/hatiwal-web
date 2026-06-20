"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Minimal, dependency-free error fallback so it renders even if the intl
// context is unavailable at the point of failure.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-7" />
      </div>
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        Please try again in a moment.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
