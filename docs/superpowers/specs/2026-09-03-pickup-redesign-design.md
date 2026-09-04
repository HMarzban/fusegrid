# Pickup redesign (2026-09-03)

Visual + SFX pass for the 12 Fusegrid pickups. **Not new powers.** `applyPower`
semantics, caps, and spawn tables stay identical. Catalog stays 12.

Public name Fusegrid / FUSE/GRID. Never Bomberman on any surface.

## Approaches

1. **Cabinet glyphs + 12-tint family (pick).** Rewrite `drawIcon` + 3D `GLYPH`
   silhouettes so each type reads at 40px. One layered pickup recipe
   (osc + harmonic + noise, ≤200ms, direct-to-destination) with 12 pitch /
   filter tints. 3D stays cube + glow ring (2 meshes / slot). Unique colors
   (fix KICK/THROW sharing `#c07a3a`).

2. **Twelve unique SFX stacks + shared chrome bezel.** Distinct recipes per
   grab; every icon sits in the same plaque. Bezels homogenize 40px read;
   twelve stacks are harder to mix consistently under 200ms.

3. **Three families × 4.** Combat / body / utility share silhouette and SFX.
   Faster, but FLAME / LINE / POWER stay too close (all “blast”).

**Pick 1.** Same canvas style, no image assets, no draw-call ABI flex.

## Rule

- `POWER[].t` / `name` / `apply` / `permanent` unchanged.
- Event stays `{ t: "power", x, y, col }` plus `kind: pdef.t` so render can
  play `item_<kind>` without colliding with plant/kick/throw/remote action SFX.
- `play("power")` remains the generic fallback when `kind` is missing.
- 2D / ITEMS / HUD / iso billboards share `drawIcon`. 3D faces share `GLYPH`.
- ITEMS menu keeps two-column cards + teal keep-rail on `permanent`.
- Frozen CFG. No DOM / `Math.random` / `Date` in `src/core`.

## Item sheet

| id | name | silhouette | color | SFX |
|---|---|---|---|---|
| fire | FLAME | three-tongue torch + yellow core | `#ff8a3c` | rising crackle (saw 392→784) |
| bomb | BOMB | round charge + fuse spark + “+” pip | `#ff5d73` | low thunk + fuse tick |
| speed | SPEED | lightning bolt | `#3db4ff` | zip-up sweep |
| heart | HEART | full heart + shine | `#ff3b5c` | warm two-note (sine) |
| shield | SHIELD | heater shield + chevron (no letter) | `#6fb7ff` | metallic clang |
| kick | KICK | side boot + motion chevron | `#c07a3a` | leather slap |
| throw | THROW | toss arc + small charge | `#ffb347` | rising whoosh |
| pass | PASS | dashed brick + through-arrow | `#77ff99` | phase shimmer |
| line | LINE | horizontal spear + energy ticks | `#d0e4ff` | short laser zap |
| power | POWER | 4-point cross-star (not a bomb) | `#ff4d5e` | fifths sting |
| pierce | PIERCE | arrow through two slabs | `#8f8fff` | slice (hp noise) |
| remote | REMOTE | plunger detonator | `#e8c35a` | two radio pips |

THROW / LINE / REMOTE colors change so no two share a hex. Fire / pierce
hexes stay (3D ring pins).

## Audio

`src/audio/item.js`: frozen `ITEM_CUE` + `itemOf(t)` + `sfxOf(ev)`.
`createAudio().play("item_"+t)` tints the shared recipe. Never `musicGain`.
Menu browse does not fire the twelve.

## Tests

`tests/pickups.test.mjs`: 12 ids, unique colors, apply mutations unchanged,
event `kind`, `sfxOf` → `item_*`, twelve distinct `itemOf.f0`,
`play("item_fire")` ≠ `play("item_heart")`, `drawIcon` paints 12 distinct
glyphs. Existing R17 / music / three item-slot pins stay green.

## Out of scope

Mid-run heat, Sudden Death, internet play, extra item types, hover SFX on
ITEMS, image/npm icon packs, 3D mesh count changes.
