# Grid tooltip copy — knowledge-level tiers (archive)

*Archived 2026-09-18 for a deferred future feature: let the player declare their
energy knowledge level and adjust terminology to match. Proposed tiers —
**novice** / **DER-pilled** / **expert derper**. Not built, not scoped. The
product-side spec for it is Shawna's to write; this file only preserves the copy
so the work isn't redone from scratch.*

Source of the live strings: `CIRCUIT_INFO` in [src/ui/Grid.jsx](src/ui/Grid.jsx).

---

## Where the two versions came from

The first pass was written in utility vocabulary — "shed," "load," "feeder,"
"circuit." It was rejected as too insider: *"This is for the person who knows
NOTHING."* The rewrite avoids the jargon entirely and teaches the one idea that
actually matters — **one icon is a group of buildings, not a single one** —
without asking the player to learn a term first.

That makes the rejected pass a usable starting point for a higher tier, and the
shipped pass the novice tier.

---

## Tile tooltips

### House

| Tier | Title | Body |
|---|---|---|
| **Expert (drafted, unused)** | Residential circuit | Each house icon represents a residential circuit — a neighborhood feeder serving many homes, not a single dwelling. Sheds first. |
| **Novice (shipped)** | A whole neighborhood | Not one house — a group of homes wired together. When power runs short, the grid switches off whole groups like this one. Neighborhoods go dark first. |

### WFH house

| Tier | Title | Body |
|---|---|---|
| **Expert (drafted, unused)** | Residential circuit (work-from-home) | A residential circuit with daytime load that does not drop off — people are home. Sheds first. |
| **Novice (shipped)** | A neighborhood working from home | Same as a regular neighborhood, but people are home all day — so it keeps using power at lunchtime instead of going quiet. These go dark first too. |

### Office

| Tier | Title | Body |
|---|---|---|
| **Expert (drafted, unused)** | Commercial circuit | A commercial feeder. Sheds after residential, before critical load. |
| **Novice (shipped)** | An office block | Busy during the day, nearly empty at night. If power runs short, offices go dark after neighborhoods but before the grocery store. |

### Grocery

| Tier | Title | Body |
|---|---|---|
| **Expert (drafted, unused)** | Critical-load circuit | Protected refrigeration load — shed last. Real plans exempt whole feeders that carry critical facilities. |
| **Novice (shipped)** | The grocery store | Stays on as long as possible, because the freezers cannot be allowed to warm up. Real power companies protect the places people depend on most. |

### Utility

| Tier | Title | Body |
|---|---|---|
| **Expert (drafted, unused)** | Utility supply | Baseload grid import. Capacity set by the modernization lever. |
| **Novice (shipped)** | Your main power supply | Where most of the electricity comes from. There is a limit to how much it can send at once — and on a hot evening, everyone wants power at the same time. |

### Peaker

| Tier | Title | Body |
|---|---|---|
| **Expert (drafted, unused)** | Peaker plant | Last-resort generation. Expensive and carbon-heavy — runs only when everything else is exhausted. |
| **Novice (shipped)** | The backup gas plant | Only fires up when everything else has run out. It is the expensive, dirty way to keep the lights on. |

---

## Other strings on the same tiering

These carried the same jargon problem and were rewritten alongside the tooltips.
They belong to whichever tier system gets built.

| Location | Expert (drafted, unused) | Novice (shipped) |
|---|---|---|
| Dark-tile indicator (`Tooltip`) | ● shed this hour — no power | ● the power is off here right now |
| Grid legend footer (`Grid`) | each tile = one circuit · drag to re-site | each tile is a group of buildings, not one · hover to see what it is · drag to move |

---

## Parked behaviour: the peaker warm-up state

*Built and working, deliberately switched off — 2026-09-23.*

Real operators commit gas turbines **before** they are strictly needed: the
machines take minutes to start, and systems hold operating reserve. So a peaker
begins warming while the grid still has roughly 10% headroom, then fires for
real once that runs out.

This shipped as a third tile state — grey `PEAKER` → amber `WARMING` → red
`BURNING` — and was then turned off. At the novice level a plant should read as
simply **off or burning**; a third state is one more thing to decode before the
basic idea has landed. It belongs to the higher knowledge levels.

**To re-enable:** set `SHOW_WARMUP = true` in [src/ui/Grid.jsx](src/ui/Grid.jsx).
The logic stays wired up and tested — `peakerWarming()` generalises across a
fleet, so each unit warms when whatever feeds in ahead of it (the utility for
the first peaker, the previous peaker for the rest) passes 90%.

| Tier | Tile states | Tooltip line |
|---|---|---|
| **Novice (shipped)** | off · burning | `off — not needed right now` |
| **Higher tiers (parked)** | off · warming · burning | `warming up — the grid is nearly maxed` |

Parked supporting copy, for whichever tier gets it:

> Gas turbines take minutes to start, so they're fired up before they're
> strictly needed — usually once the grid is about 90% used.

## Notes for whoever builds this

- **The middle tier ("DER-pilled") is unwritten.** Only the two ends exist.
- **The expert column is a draft, not a shipped tier** — it was never reviewed as
  expert-level copy, only rejected as novice-level copy. Treat it as raw material.
- **The grocery copy has a known accuracy strain.** A real grocery store almost
  never sits on its own circuit — it typically has a dedicated *transformer*, but
  shares a feeder with many other customers. Utilities protect feeders that carry
  critical facilities (hospitals, water treatment), not grocery stores as such.
  Both tiers soften this rather than resolve it. A hospital or water-plant tile
  would model protection honestly; the spec already flags a hospital tier as
  future work (§3.5).
