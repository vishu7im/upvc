# Phase 4 — Door option parity, honestly gated

## Goal

Every row the reference door product offers appears in our Designer. The ones we can fabricate,
fabricate. The ones we cannot say so, in the option itself.

## Context-in-a-box

`collections/doors/lineitems.json` is the reference app's own payload for a single door: **41
specification rows** across `Profile & Ancillary Options`, `Hardware Options`, `Glass, Slab and
Panel Options`, `General Options` and `Location`. Our `entrance-door` family
(`src/catalog/families/entrance-door.ts` + `src/catalog/options/doors.ts`) serves 22 — 15 shared
via `adoptShared()` and 7 door-specific.

Phases 1 and 2 supply the add-on rows and the four frame rows. This phase covers the rest.

The precedent for a gated option is already in the repo and must be followed exactly:
`pricingMode: "none"`, `engineEffect: { kind: "none" }`, and a `presentation.helpText` naming the
missing part or the missing calibration — as `profile.door-sash-profile` and `hardware.threshold`
already do (`../questions.md` Q7).

## Deliverables

| Reference row | Our treatment | Why |
|---|---|---|
| **Hinge Colour (Door)** (9 choices) | **Real** — a finish chip on the one `hinge` slot | `hardware-stock.generated.ts` holds 8 flag + 9 high-security hinges by finish |
| **Hinge (Door)** (Flag / High Security) | **Real** — a style chip on the same slot | one answer, two axes (see the deviation below) |
| **Hinge Position** (3 / 4 / 5) | Gated | the engine emits a fixed 3 per leaf (Job 90); no document gives 4 or 5 |
| **Restrictor (Door)** | Gated | no restrictor part in the catalog |
| **Ventilator (Frame)** / **(Sash)** | Gated | `TRICKLE_VENT` in `src/engine/limits.ts` is reference data with no consumer; `../questions.md` Q16 |
| **Glass Decoration** (Astragal / Georgian / Leaded) | Gated | no bar part, no cut rule |
| **Glass Gas Fill** (Argon / Air) | Gated | glass rows are per-m²; gas is not itemised anywhere |
| **Opening Direction** (Open In / Out) | Documents-only | recorded and printed; no cut effect for an inward-opening door, and no outward door reference |
| **Threshold** | keep the existing gate, relabelled to the reference's `PRAG-S-70 Low Threshold` | no threshold part exists |
| **Lock (Door)** (Standard / High Security / Shootbolt) | **Real** — already a slot; widen the choice list | the parts exist in the stock list |
| **Sash Type** (13 kinds) | extend `profile.door-leaf` to the kinds the engine models | the rest are omitted, not faked |
| **Component Type**, **Split Position**, **Drainage**, **Location**, **Glazing Method**, **Glass Type**, **Cill**, **Bead**, **Colour ×2** | already served | — |

Group ordering follows the reference's four groups, which our seed already mirrors
(`profile-ancillary`, `hardware`, `glazing`, `general`, plus `structure` / `placement`).

## Implementation checklist

- [x] ~~Split the hinge slot into style and finish, both writing the same substitution slot.~~
      **Deviation — not done, on purpose.** Two dropdowns writing ONE 1:1 substitution slot would
      conflict by construction: answering "Flag" and "Gold" separately gives two selections for the
      same slot, and the resolver would have to pick one and warn. Our 17 hinge rows already encode
      both axes in their names, so the hinge picker gained a **style chip** beside the finish chips
      (`DOOR_HINGE_STYLE_FILTERS`) instead. Same two axes, one answer, no possible contradiction.
      Locks and cylinders got the same treatment (`DOOR_LOCK_STYLE_FILTERS`, `CYLINDER_STYLE_FILTERS`).
- [x] Widen `hardware.door-lock` to the full stock list minus `NOT_SELECTABLE`.
- [x] Add the six gated options with their reasons.
- [x] Add `general.opening-direction` as documents-only.
- [x] Extend `profile.door-leaf` to every `SashKind` the engine models for this family.
- [x] Re-run `validateOptionSystem` — every choice must still point at a live catalog part, and no
      cost/price key may reach the public payload.

### Verified live (2026-07-30)

`GET /api/families/entrance-door` serves **37 options across 6 groups** — every row the reference
door product offers. Hardware: door handle **54** choices, cylinder **15**, hinges **18**, lock
**9**, each carrying a picture. The gated rows (hinge position, restrictor, both ventilators, glass
decoration, gas fill, opening direction, threshold, door sash profile, joint method) all serve
`pricingMode: "none"`, and a defaults-only door still resolves clean at net £244.36 with 0 issues.

## Acceptance criteria

- The door inspector shows every group the reference shows, in the same order.
- Every gated option states its reason in helpText and changes neither cut nor price.
- The golden byte-identity test for a defaults-only door draft still reproduces a direct `solve()`.

## Out of scope

- Buying or modelling parts we do not stock.
- Registering the French door as its own family (recipe exists; separate ask).
