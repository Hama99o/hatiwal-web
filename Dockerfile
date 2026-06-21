# syntax=docker/dockerfile:1
# Production image for hatiwal-web (Next.js 15, standalone output).
# Built & deployed by Kamal (config/deploy.yml). Node pinned to 18 — the app is
# pinned to Next 15 because Next 16 needs Node >= 20.9 (see AGENTS.md).
#
#   NEXT_PUBLIC_* vars are baked into the client bundle at BUILD time, so Kamal
#   passes them as build args (builder.args in deploy.yml). Server-only runtime
#   vars (API_URL, PORT, …) are injected at boot via env.clear instead.

ARG NODE_VERSION=18-bookworm-slim

# ── deps ──────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# --legacy-peer-deps + the oxide native-binding fix: npm's optional-deps bug can
# skip @tailwindcss/oxide's linux binary, so install the matching one explicitly.
RUN npm ci --legacy-peer-deps \
 && OXIDE_VER="$(node -p "require('@tailwindcss/oxide/package.json').version")" \
 && npm install --no-save --legacy-peer-deps "@tailwindcss/oxide-linux-x64-gnu@${OXIDE_VER}" || true

# ── build ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS build
WORKDIR /app

# Public (client-baked) config — supplied by Kamal builder.args.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_RAILS_ORIGIN
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_NAME=Hatiwal
ARG NEXT_PUBLIC_DEFAULT_LOCALE=en
ARG NEXT_PUBLIC_DEFAULT_THEME=system
ARG NEXT_PUBLIC_DEEP_LINK_SCHEME=hatiwal
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_RAILS_ORIGIN=$NEXT_PUBLIC_RAILS_ORIGIN \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_DEFAULT_THEME=$NEXT_PUBLIC_DEFAULT_THEME \
    NEXT_PUBLIC_DEEP_LINK_SCHEME=$NEXT_PUBLIC_DEEP_LINK_SCHEME \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone server + the assets it serves. server.js bundles only the deps it needs.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
