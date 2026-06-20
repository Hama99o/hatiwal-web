import { notFound } from "next/navigation";

// Any unmatched path under a locale falls through to the localized not-found UI.
export default function CatchAllPage() {
  notFound();
}
