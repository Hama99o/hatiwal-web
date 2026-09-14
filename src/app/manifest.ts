import type { MetadataRoute } from "next";

// PWA manifest. Served at /manifest.webmanifest (the i18n middleware skips it —
// the matcher excludes any path with a dot). Spec fields (name, colors) are
// locale-neutral brand values, so they're intentionally not translated.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hatiwal",
    short_name: "Hatiwal",
    description: "Buy and sell locally in Afghanistan.",
    start_url: "/",
    display: "standalone",
    background_color: "#12224F",
    theme_color: "#12224F",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
