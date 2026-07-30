# Phase 3 — A picture on every hardware choice

## Goal

Close the owner's third report: *"its show with ui what its look for example handels but in our app
its just text field"*. Every hardware choice gets a picture, with a path for real product photos.

## Context-in-a-box

The reference renders handles, cylinders, hinges, restrictors, ventilators, glass decorations and
locations as an image grid — `collections/doors/WhatsApp Image 2026-07-30 at 4.01.39 PM (3)…(7)`.
In its payload (`collections/doors/lineitems.json`) each choice carries
`imageUrl: "https://media.bm-touch.co.uk/…"` — **third-party CDN JPEGs**. The only SVG in that file
is the window elevation (`/images[0..2]/image`), not hardware. So the artwork has to be ours.

**Almost all the plumbing already exists and is unused.** `OptionChoice.image` is typed
(`src/designer/option-types.ts`, `{ kind: "catalog-asset" | "url"; ref: string }`), has a DB column
(`prisma/schema.prisma` `option_choice.image Json?`), is written by `prisma/seed.ts`, read by
`src/catalog/loader.ts`, served verbatim by `GET /api/families/:key`, and declared in
`web/lib/types.ts`. What is missing is: something that sets it, something that resolves
`catalog-asset` to bytes, and a renderer that looks at it. `ImageChoices` in
`web/components/designer/controls/index.tsx` currently draws a 24 px `swatchHex` square (grey when
unset) plus the label — which is why colours look right and handles look like text.

There are **128 stock hardware rows** (`src/catalog/hardware-stock.generated.ts`) across five
sub-categories, and `src/catalog/options/hardware-filters.ts` already derives finish / style / hand
chips from the supplier's own naming. That derivation is exactly the input a glyph needs.

The asset seam to copy is the branding logo: deterministic object key, storage checked first,
`GET /api/branding/logo` streaming it (`src/api/server.ts`), `POST /api/settings/logo` taking a raw
`image/*` body (`src/api/settings.ts`), all through `src/services/storage.ts`. Key-existence IS the
cache — the same trick the PDF routes use — so an uploaded photo needs **no migration**.

## Deliverables

1. **`src/catalog/glyphs.ts` (new, pure — no I/O).** `hardwareGlyph(part)` → an SVG string, drawn
   from (financialCategory × style chip × finish chip): door lever/lever and lever/pad on short and
   long backplates, bar handles, casement handles, euro cylinder ± thumbturn, flag hinge, high
   security hinge, lock body, keep. Finish drives the metal gradient. Deterministic — the same part
   always yields the same bytes.
2. **`GET /api/catalog/assets/hardware/:partKey`** (public, like `GET /api/branding/logo`) —
   object storage `catalog/hardware/{partKey}` first, generated glyph on miss.
3. **`POST /api/catalog/:systemId/hardware/:partKey/image`** (admin, raw `image/*` body) — mirrors
   the logo upload; writes that key; existence is the override.
4. **Seed** — hardware choices in `src/catalog/options/windows.ts` and `doors.ts` carry
   `image: { kind: "catalog-asset", ref: "hardware/<partKey>" }`. Colour choices keep `swatchHex`.
5. **`ImageChoices`** renders `choice.image` through the BFF, in a larger tile grid, with
   swatch → image → grey as the fallback chain. Filter chips are untouched.
6. **`choicePatchSchema`** (`src/api/families.ts`) accepts `image`, so an admin can repoint a choice.

## Implementation checklist

- [x] `src/catalog/glyphs.ts` + its unit assertions (determinism, one glyph per category, finish
      tint applied, unknown category falls back rather than throwing).
- [x] `src/services/storage.ts` — reuse; no new code expected beyond a key helper.
- [x] `src/api/catalog.ts` — the GET and the admin POST.
- [x] Seed: `image` on the four door slots + the casement handle option.
- [x] `web/components/designer/controls/index.tsx` — tile + trigger render the image.
- [x] `web/app/(app)/admin/catalog/*` — an upload control beside each hardware row.

## Acceptance criteria

- Opening the door handle picker shows 54 tiles, each with a picture, and the finish/style chips
  still narrow the list.
- No option key appears anywhere under `web/` (the D3/D8 grep).
- Uploading a photo for one part replaces that tile only, immediately, with no reseed.
- With object storage unavailable the glyph still renders (storage failure is non-fatal, as with
  branding).

## Out of scope

- Photographs for parts we do not stock.
- Imagery for profile, glass or panel choices (the reference has none for most of them either).
