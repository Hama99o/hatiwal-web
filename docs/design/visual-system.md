# Visual system (web) — design note (2026-10-15, d0)

The owner's verdict after the layout/UX pass was "it's not looking good". e5's pass
(docs/design/home.md … auth.md) fixed **where** things are. This note covers **how they
look**: cards, type, colour, spacing, the header, buttons, chips, empty states and the
footer. The page-level layout decisions in the other notes still stand.

Everything lives in **tokens** (`src/app/globals.css`) and the **shared components**. No new
UI library. RTL (ps/fa) is covered by the same components: logical properties
(`ps`/`pe`/`start`/`end`) everywhere, and bidi isolates for user text.

## 1. References (Mobbin, web)

| What | Screen | Takeaway |
|---|---|---|
| Card grid | **Etsy** — search results · https://mobbin.com/screens/eb6cef55-447c-4d6b-9893-cf5e5921772e | No card box: a rounded photo, then price (bold), a one-line title, a muted meta line. Pill "All filters" / sort. |
| Card grid | **Etsy** — category page · https://mobbin.com/screens/d77777f0-40d7-4b7b-8ab7-69978f505777 | Pill search with a round accent button; dark selected chips. |
| Card grid + hero | **Airbnb** — homepage · https://mobbin.com/screens/ef8fe96f-1fb9-4b17-97d3-625b20344e39 | Rounded photos (~12px), white disc heart, white pill badges on the photo ("Guest favorite"). |
| Footer | **Airbnb** — footer · https://mobbin.com/screens/be75a9b8-714a-4a56-aa19-816ad5d2600d | A soft grey band, three link columns, small print on a hairline. |
| Second-hand grid | **Depop** — seller page · https://mobbin.com/screens/a3f9bb05-c4fc-4621-8ebb-1142a3c998af | Square photos, price-first, almost no chrome. |
| Banner card | **Depop** — home banner · https://mobbin.com/screens/d022ade0-0511-4d46-801c-f4e8fa393e3b | The hero is a rounded card in the page width, not a full-bleed gradient. |
| Card grid | **Faire** — brands · https://mobbin.com/screens/8827edda-6b0e-4455-8fbf-b61d57cc28c4 | White "Top Shop" pills on photos; pill filter chips. |
| Empty state | **Klarna** — Saved · https://mobbin.com/screens/d5faa55c-399a-4279-b11b-f798d2f988ea | Tinted icon, one headline, one sentence, ONE filled button. |
| Empty state | **Expedia** — no saves · https://mobbin.com/screens/fcdc30c1-18a6-4a11-aa32-60d7dcb06491 | Same pattern, the icon in a soft circle. |
| Product card | **Klarna** — product grid · https://mobbin.com/screens/ab04c0f2-28f4-4b54-9a72-76cdd148428a | Photo on a tinted tile, small rounded badge. |

(Vinted, OLX, Facebook Marketplace and Wallapop have no web screens on Mobbin; the second-hand
references are Depop + Etsy, which follow the same price-first, photo-first card.)

## 2. Tokens

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | **white** (was 98% grey) | unchanged | The page. Photos carry the colour. |
| `--surface` (new) | `hsl(220 24% 97%)` | `hsl(222 50% 8%)` | Soft bands: the footer, empty states, pill search, category pills. Separates regions without boxes. |
| `--muted-foreground` | `hsl(217 15% 39%)` — **6.4:1** on white (was 4.8:1) | unchanged | Meta lines, captions. |
| `--border` / `--input` | `hsl(220 16% 90%)` / `hsl(220 14% 84%)` | unchanged | Inputs a step darker than hairlines, so an empty field still reads as one. |
| `--primary` | brand blue **#2563EB**, unchanged | unchanged | CTAs, links, active state. |
| `--primary-soft` (new) | `hsl(221 90% 96%)` | `hsl(221 60% 16%)` | Tinted chips, selected states, the empty-state disc. |
| `--*-ink` (new) | primary 40% · success 24% · warning 28% · destructive 38% · seller 22% L | light inks | **Text on a 10–15% tint of its own hue** (report #23). The fills as 10.5px text on their own tint measured 2.3–4.5:1; the inks measure **6.1–7.4:1** (light) and **7.5–9.4:1** (dark). |
| `--brand-gold` / `--brand-lapis` | unchanged | unchanged | The hero card (lapis) and its CTA (gold, lapis text). |
| `--seller` | emerald, unchanged | unchanged | Seller-mode accent (bar, active marks), never small text on white. |

### Elevation
Slate-tinted, layered, never pure black:
`shadow-xs` (buttons, inputs) · `shadow-card` (a photo or panel lifted on hover) ·
`shadow-pop` (menus, sheets, the app bar, the hero search).

### Type (Rubik; Zain / Noto Sans Arabic lead in fa / ps — unchanged)

| Utility | Size / line / tracking | Use |
|---|---|---|
| `text-display` | 40 / 1.08 / -0.025em | Hero title (sm+); 30px on phones, 52px at lg. |
| `text-title` | 28 / 1.15 / -0.02em | Page h1. |
| `text-heading` | 20 / 1.3 / -0.012em, bold | Section h2 ("Recent listings", "Shop by category"); 24px on sm+ for page-level rails. |
| `text-base`/`sm`/`xs` | Tailwind | Body 14–16px; inputs are **16px on phones** (no iOS zoom), 15px from sm. |
| Price | `font-bold tracking-tight tabular-nums` | `PriceTag` — the loudest thing on a card. |

### Shape and spacing
- **Pills** for every button, chip and search field (`rounded-full`); **rounded-xl** for inputs and
  photos, **rounded-2xl** for panels and the list card, **rounded-3xl** for the hero card and sheets.
- **Touch: 44px.** `Button` is 40/36px with a mouse and **44px on a touch screen at every size**
  (`pointer-coarse:`), and the same rule is applied to the avatar menu, the sort select, condition
  chips, footer links, category chips (an invisible hit box) and the map zoom (report #22).
- Grid rhythm: **12–16px between columns, 24–32px between rows** — with no card box, the text under
  a photo must not read as the caption of the photo below it.
- Page sections: 40px apart on phones, 48px on sm+.

## 3. Components

- **`ListingCard` (grid)** — no box. A square photo, `rounded-xl` with a 5% inset ring, lifted with
  `shadow-card` and a 1.04 zoom on hover; then price (+ firm badge), a 2-line title at 85% ink, and
  ONE meta line: shop chip · condition in words · place. Photo badges (status, Seen, price drop) are
  white pills. Owner cards with an action footer keep a panel (`rounded-2xl border`), so their buttons
  belong to something. The list variant keeps its panel, rounder.
- **Heart** — a 36px white disc with `shadow-card` inside a **44px** hit area.
- **`Button`** — pill, semibold; primary has `shadow-xs` and deepens to `--primary-strong` on hover;
  outline goes to `--surface` on hover; a 2% press scale.
- **`Input` / `Textarea` / native select** — 44px, `rounded-xl`, `shadow-xs`, a soft 4px primary
  focus ring. One `nativeSelectClass` (field / pill) replaces three hand-written copies.
- **`Badge`** — tinted fills with **ink** text; `outline` gets a real border on white.
- **Header** — 95% white with a stronger blur, a lighter hairline, a wider pill search (`max-w-xl`),
  a named nav landmark.
- **Hero** — a lapis card in the page width with a gold and a blue glow; white type; on phones a gold
  "Explore the Bazaar" and a glass "New Listing"; from sm the search is a white pill inside it.
- **Category pills** — on `--surface`, the emoji in a white disc; lift to white + `shadow-card` on hover.
- **Empty state** — on `--surface`, no dashed box; the icon in a `--primary-soft` disc with a halo;
  a filled CTA.
- **Footer** — a `--surface` band; three columns (brand, Explore + "Get the app", Legal) under
  uppercase micro-headings; each `<nav>` is named by its heading (report #23 `landmark-unique`).
- **Password fields** — a show / hide eye at the inline end (report #28).
- **App nudge** — one slim bottom bar on phones instead of a modal (report #12).

## 4. RTL
- All new spacing is logical (`ps`/`pe`/`start`/`end`); glows and the hero card mirror for free.
- User text keeps its own direction (`userTextProps`, `<bdi dir>`), so a Latin title or name inside a
  Pashto / Dari row truncates at ITS end (sell-as names, report #26).
- Checked at 390 and 1440 in fa (screens in the before/after sheet).

## 5. Not changed on purpose
- Brand colours and fonts. The listing photo stays **square** (Depop/Etsy; Hatiwal's photos are
  mixed phone shots, and 1:1 crops them most evenly).
- Mobile app tokens: web-only changes (`--surface`, inks); the shared values are untouched.
