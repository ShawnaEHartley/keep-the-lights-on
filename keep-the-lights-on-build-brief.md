# Keep the Lights On — Claude Code Build Brief
*Dev-facing build order. Source of truth for behavior is `keep-the-lights-on-spec.md` — this doc sequences the work and defines acceptance checks. When this brief and the spec disagree, the spec wins; flag the conflict.*

---

## What you're building
A single-page, client-side energy sim. A grid city of buildings + equipment; a 24-hour day animates an hourly supply-vs-demand contest; a dashboard reports consequences. No backend — the entire sim is client-side math. Full behavior in the spec; build it in the order below.

## Stack & deploy
- **React** SPA, **Vite**, plain CSS or Tailwind (match the Signal Grid aesthetic).
- **No backend, no API calls.** Pure client-side.
- `localStorage` optional (save-city) — *not* required for v1.
- Deploy target: GitHub Pages or Vercel, static build.

## File structure
```
src/
  engine/
    shapes.js      // normalized 24h load/solar curves
    dispatch.js    // the hourly merit-order loop (spec §3.4)
    metrics.js     // dashboard roll-ups (spec §3.6)
    engine.test.js // calibration anchor + unit tests
  state/
    cityModel.js   // grid layout, entity config, levers, day counter
  ui/
    Grid.jsx       // placement + building/equipment squares
    DayClock.jsx   // 24h animation driver
    FlowArrows.jsx // animated energy-flow overlay
    Dashboard.jsx  // reliability / peaker / $ / CO2 + ghost baseline
    Levers.jsx     // temp, cloud, modernization
    WaiverModal.jsx// off-grid gate
  App.jsx
```

---

## Build sequence

### Phase 0 — Scaffold
Vite + React project, file skeleton above, dev server runs. **Done when:** empty app boots clean.

### Phase 1 — ENGINE FIRST (the gate — no UI yet)
Build and unit-test the engine against the calibration anchor **before writing any UI.** This is non-negotiable; the sim is only as good as this loop.

Function contracts:
```js
// shapes.js
getLoadShape(buildingType) -> number[24]   // normalized, sums to 1
getSolarShape() -> number[24]              // normalized, sums to 1

// dispatch.js  (algorithm body = spec §3.4; battery charge carries across hours)
runDay({ buildings, solarUnits, batteries, uCap, peakCap, levers }) -> {
  hourly: [{ t, demand, solarServed, batteryCharge, batteryDischarge,
             utility, peaker, shortfall, curtailment }],
  totals: { peakerEnergy, brownoutHours, buildingHoursLost, curtailment }
}

// metrics.js  (spec §3.6)
computeMetrics(dayResult, prevDayResult?) -> {
  reliability: { brownoutHours, buildingHoursLost },
  peakerEnergy, cost, carbon, curtailment,
  deltas   // vs prevDay, for the ghost baseline
}
```

**First acceptance test (write this test first):**
> Scenario: starting city = 5 houses, 1 grocery, 1 office. No solar, no batteries. Modernization = 30%. Temperature ≥ 80°F.
> Assert: `brownoutHours ≈ 2`, and the brownout hours fall in the **evening** block.
> Tune `uCap + peakCap` until this passes. This is the calibration anchor (spec §8) and the baseline all other numbers tune around.

Additional engine sanity tests:
- Add 1 battery to the anchor scenario → `peakerEnergy` drops and/or `brownoutHours` falls.
- Flip all house roofs to solar → midday `curtailment` appears if no battery; drops when a battery is added.
- Set `uCap = peakCap = 0` (off-grid) with undersized battery → overnight `shortfall` (brownout); with a battery sized to carry the overnight load → no brownout.

**Tuning constraint (bake into unit scale now, even though display rounding is deferred):** scale units so a *single* battery or *single* roof-solar moves a headline metric by **≥ 1 whole unit**. If one battery shaves peaker 7.4→6.6 (both round to 7), the feedback loop is dead. Coarsen units until each meaningful action visibly moves an integer.

**Done when:** all engine tests pass, anchor included. Engine verified in console before any pixels.

### Phase 2 — Static grid + dashboard (no animation)
Render the grid, place the starting city, run `runDay` once, show the dashboard with final whole-number metrics + ghost baseline. Per-building display: a plain rounded daily total on hover is fine as a **placeholder** — display treatment is intentionally deferred to playtest (PM will iterate after seeing it live).
**Done when:** starting city renders and the dashboard shows the anchor's brownout result.

### Phase 3 — Day animation + flow arrows
Drive the 24h clock; animate demand/supply curves and the `FlowArrows` overlay (utility→building, solar→battery, battery→house; thickness/pulse ∝ flow). Equipment squares (solar, battery) show charge/discharge state.
**Done when:** pressing "run day" plays a smooth animated cycle that matches the engine's hourly output.

### Phase 4 — Levers + interactions + waiver
Three levers (temperature, cloud cover, modernization/renewable-mix %); place/remove buildings; flip roof to solar; place battery/solar squares; off-grid **waiver modal** that zeroes the utility caps on signing (spec §5).
**Done when:** every spec §5 action works and re-runs the day.

### Phase 5 — EASY MODE COMPLETE (vertical slice)
Houses, WFH houses (~30% default, `(wfh)` hover tag), office, grocery, utility+peaker, solar, battery, emergent VPP behavior, all levers, full dashboard, waiver.
**Done when:** a person who's never seen it can place buildings, run days, watch peaker energy fall when they add a battery, and brown out the city if they go off-grid undersized — all without instructions.

### Phase 6 — MEDIUM (additive)
Gas stations; gas→EV swap + charge-window control (6pm worsens peak, midday/overnight helps); optional V2G; larger starting city.

### Phase 7 — HARD (additive)
Data center (flat 24/7, bundled midday solar); grid-emergency "VPP call" event on the hottest day (all enrolled batteries/EVs discharge at once).

---

## Guardrails / do-not
- **Do not build UI before Phase 1 passes.** Engine + calibration anchor first.
- **Do not build Medium/Hard until Easy is a complete, playable slice.**
- **Do not** turn arrows into a wiring puzzle — everything auto-connects; arrows are visualization only (spec §11).
- **Do not** add a budget/cost-gating system — free placement, cost is readout-only for v1 (spec §11).
- **Do not** over-engineer per-building display — rounded hover total as placeholder; PM iterates after seeing it live.
- **Do not** add a backend, accounts, or required persistence.

## Definition of done (v1)
Easy mode (Phase 5) is complete, the engine passes the calibration anchor, the day animates with flow arrows, all three levers and the off-grid waiver work, and the build deploys static to Pages/Vercel. Medium and Hard are stretch layers on the same engine.
