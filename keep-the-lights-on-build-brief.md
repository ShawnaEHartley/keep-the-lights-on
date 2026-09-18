# Keep the Lights On — Claude Code Build Brief
*Dev-facing build order. Source of truth for behavior is `keep-the-lights-on-spec.md` — this doc sequences the work and defines acceptance checks. When this brief and the spec disagree, the spec wins; flag the conflict.*

---

## What you're building
A single-page, client-side energy sim. A grid city of buildings + equipment. While you build, a live **estimate** shows the expected day; pressing **Run Day** rolls the actual (randomized) weather and animates an hourly supply-vs-demand contest; a dashboard reports the actual outcome against the estimate. No backend — the entire sim is client-side math. Full behavior in the spec; build it in the order below.

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
    weather.js     // expected vs sampled weather (spec §3.7)
    dispatch.js    // merit-order loop + building-tier shedding (spec §3.4, §3.5)
    metrics.js     // dashboard roll-ups, estimate-vs-actual (spec §3.6)
    engine.test.js // calibration anchor + unit tests
  state/
    cityModel.js   // grid layout, entity config, levers, day counter
  ui/
    Grid.jsx          // placement + building/equipment squares
    EstimatePanel.jsx // live "expected day" estimate while building (spec §2, §3.7)
    DayClock.jsx      // Run Day reveal animation driver (24h)
    FlowArrows.jsx    // animated energy-flow overlay
    Dashboard.jsx     // actual outcomes vs estimate + ghost baseline
    Levers.jsx        // temp, cloud (climate baseline), modernization
    WaiverModal.jsx   // off-grid gate
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
getLoadShape(buildingType, season) -> number[24]   // normalized; summer vs winter shape
getSolarShape(season) -> number[24]                // normalized; weaker/shorter in winter

// weather.js  (spec §3.7, §3.9)
expectedWeather(climate) -> weather        // baseline, deterministic — used for the estimate
sampleWeather(climate, seed) -> weather    // ~5–6 intraday segments + season + a daily
                                           // contingency derate (§3.9), randomized — Run Day

// dispatch.js  (spec §3.4 merit order + §3.5 shedding + §3.3a efficiency; battery carries hours)
runDay({ buildings, solarUnits, batteries, uCap, peakCap, weather }) -> {
  hourly: [{ t, demand, solarServed, batteryCharge, batteryDischarge,
             utility, peaker, shortfall, curtailment, shedBuildingIds }],
  totals: { peakerEnergy, brownoutHours, perBuildingHoursLost, curtailment,
            energyBySource: { solar, battery, baseload, peaker },  // for carbon/cost
            reserveMargin }                                        // §3.9
}
// Estimate: runDay with expectedWeather(). Actual: runDay with sampleWeather() on Run Day.

// metrics.js  (spec §3.6, §3.8, §3.9)
computeMetrics(actualResult, estimateResult, prevDayResult?, renewableMix) -> {
  reliability: { brownoutHours, perBuildingHoursLost },
  peakerEnergy,
  carbon: { total, benchmark },   // per-source intensity; baseload intensity = f(renewableMix)
  cost,                           // per-source tally (readout, not a market signal)
  reserveMargin, reserveTrend,    // end-of-day + multi-day
  curtailment,
  vsEstimate,                     // actual − estimate
  deltas                          // vs prevDay, ghost baseline
}

// constants.js
ROUND_TRIP_EFF ≈ 0.90                    // per-cycle only; no aging, no self-discharge
baseloadCarbonIntensity(renewableMix)   // high at 30%, low at 90%
PEAKER_CARBON_INTENSITY                 // high constant
CONTINGENCY                             // daily capacity-derate range + demand-spike range
```

**First acceptance test (write this test first):**
> Scenario: starting city = 5 houses, 1 grocery, 1 office. No solar, no batteries. Modernization = 30%. Temperature ≥ 80°F. **Run with `expectedWeather` (deterministic — randomness OFF) so the test is reproducible.**
> Assert: `brownoutHours ≈ 2`, the brownout hours fall in the **evening**, and the shed buildings are **houses** (grocery stays lit — see §3.5 tiers).
> Tune `uCap + peakCap` until this passes. This is the calibration anchor (spec §8) and the baseline all other numbers tune around.

Additional engine sanity tests:
- Add 1 battery to the anchor scenario → `peakerEnergy` drops and/or `brownoutHours` falls.
- Flip all house roofs to solar → midday `curtailment` appears if no battery; drops when a battery is added.
- Set `uCap = peakCap = 0` (off-grid) with undersized battery → overnight `shortfall` (brownout); with a battery sized to carry the overnight load → no brownout.
- Force a shortfall hour with mixed buildings → assert the **lowest-priority tier sheds first** (houses dark, grocery still lit), and `perBuildingHoursLost` counts per building, not grid-wide.
- With weather randomization ON (`sampleWeather`), run the same plan many times → outcomes vary around the estimate; a margin-tight plan browns out on a fraction of hot/cloudy rolls. (Demonstrates the plan/reveal mechanic; not a fixed assertion.)
- **Carbon decoupling:** city tuned to `peakerEnergy = 0` on a 30%-renewable grid → `carbon.total` stays well **above** `carbon.benchmark` (dirty baseload). Add solar / raise renewable mix → carbon drops. Proves carbon ≠ peaker.
- **Battery efficiency:** store N units, discharge → delivered ≈ N × 0.90. Re-storing/holding longer does **not** lose more (per-cycle only).
- **Reserve margin:** apply a contingency derate → `reserveMargin` falls; add a battery/DER → it recovers; drive it negative → buildings shed (ties to §3.5).

**Tuning constraint (bake into unit scale now, even though display rounding is deferred):** scale units so a *single* battery or *single* roof-solar moves a headline metric by **≥ 1 whole unit**. If one battery shaves peaker 7.4→6.6 (both round to 7), the feedback loop is dead. Coarsen units until each meaningful action visibly moves an integer.

**Done when:** all engine tests pass, anchor included. Engine verified in console before any pixels.

### Phase 2 — Static grid + estimate readout (no animation yet)
Render the grid, place the starting city, run `runDay` with `expectedWeather`, and show the live **estimate panel** + dashboard (reliability, peaker, carbon vs the "good" benchmark with **no source breakdown**, reserve margin). The estimate updates as pieces are placed/removed. Per-building display: a plain rounded daily total on hover is fine as a **placeholder** — display treatment is deferred to playtest (PM iterates after seeing it live).
**Done when:** starting city renders and the estimate panel shows the anchor's expected brownout result, updating live as you add/remove a building.

### Phase 3 — Run Day reveal: animation + flow arrows
"Run Day" rolls `sampleWeather`, then drives the 24h clock: animate demand/supply curves and the `FlowArrows` overlay (utility→building, solar→battery, battery→house; thickness/pulse ∝ flow). Equipment squares show charge/discharge; shed buildings visibly go dark. After the reveal, the dashboard shows actual-vs-estimate.
**Done when:** Run Day plays a smooth animated cycle matching the engine's hourly output, the actual result differs from the estimate when the weather roll differs, and shed buildings darken in priority order.

### Phase 4 — Interactions + levers + waiver
Place/remove buildings; flip roof to solar; place battery/solar squares; four levers as **climate baseline** (temperature, cloud cover, season, modernization/renewable-mix % — which also sets baseload carbon) that reshape both the estimate and the sampled day (spec §3.7, §3.8, §4); off-grid **waiver modal** that zeroes the utility caps on signing (spec §5). Every edit re-runs the estimate live.
**Done when:** every spec §5 action works, the estimate updates as you build, and levers move both estimate and actual.

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
- **Do not** build Operations mode (player-set shed priority tiers) or flexible-load shedding in v1 — tagged future (spec §3.5). v1 ships the fixed default tier order: house → office → grocery.
- **Do not** let weather randomness touch the calibration test — that test runs on `expectedWeather` (deterministic). Randomness is for Run Day only.
- **Do not** show a per-source carbon breakdown — the dashboard shows CO₂ total + the "good" benchmark only. Discovery is the point (spec §3.8).
- **Do not** "correct" the all-data-centers-have-solar model — it's an intentional aspirational design choice (spec §3.2, §12).

## Definition of done (v1)
Easy mode (Phase 5) is complete: the engine passes the (deterministic) calibration anchor, building-tier shedding works, per-source carbon reads against its benchmark (with no breakdown shown), reserve margin responds to the daily contingency, the build-mode estimate updates live, Run Day rolls real weather and reveals an animated day whose actual outcome can diverge from the estimate, all four levers (incl. season) and the off-grid waiver work, and the build deploys static to Pages/Vercel. Medium and Hard are stretch layers on the same engine.
