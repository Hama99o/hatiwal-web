import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // .next-e2e is the isolated build dir the Playwright E2E run produces; like
  // .next it is generated output and must never be linted.
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      // A suite on its own ports builds into `.next-e2e-<port>` (and a scratch
      // build into `.next-<name>`, see AGENTS.md): generated output too.
      ".next-*/**",
      // Vendored, minified third-party code (Mapbox's RTL text plugin, served
      // as is to the map): not ours to lint.
      "public/mapbox-gl-rtl-text.js",
      // Turbopack-in-Docker orphans: when the root-owned container can't remove
      // a .next it doesn't own it renames it aside. Pure build cache (gitignored)
      // — must never be linted, same as .next itself.
      ".next-root-owned-orphan-*/**",
      ".next.rootowned.bak/**",
      "out/**",
      "build/**",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
