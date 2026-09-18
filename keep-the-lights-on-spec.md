# Keep the Lights On — Product & Dev Spec
*A gamified energy distribution sim — a little city that runs on timing. v1 spec for handoff to dev.*

---

## 1. One-line pitch

A grid-based "city" sandbox where you place buildings and energy equipment and watch a day animate hour by hour — learning, by playing, why the grid runs on *when* you use power, not just *how much*. The lesson lands without a single chart: solar peaks at noon, homes peak at 6pm, and the gap between them is the entire reason peaker plants, batteries, and VPPs exist.

**Audience:** an uninformed player. No prior energy knowledge. Someone who's never heard "duck curve" should *feel* it in ten minutes.

**The core insight the whole design serves:** energy is a timing problem. Every mechanic exists to make timing visible.

---

## 2. Core loop

The loop splits into **plan** and **reveal** — which is what makes weather and planning matter.

1. **Build & plan** — place/move buildings and equipment. A live **estimate** updates as you build: "on a typical day for this climate, expect ~5 peaker, 0 brownout hours." This is your benchmark — you're tuning the city against the *expected* day before committing.
2. **Run the day (reveal)** — the actual day's weather is rolled (sampled around your climate setting, so it's *not* identical to the estimate), then the day animates hour by hour: demand/supply curves move, flow arrows show energy moving, equipment charges and discharges.
3. **Read the consequences** — the dashboard reports the *actual* outcome against the estimate. A tight plan that looked fine on a typical day may brown out on a hot, cloudy one.
4. **Adjust & advance** — respond to what the variance revealed (add storage margin, more solar), then run the next day.

No timer, no win/lose, no "game over." A sandbox with a **soft objective**: keep the city powered while shrinking the dirty/expensive stuff, *across good days and bad ones*. The player self-directs toward "can I cut peaker energy without anyone losing power — even on the worst day?"

> **Why the estimate/reveal split matters (portfolio gold):** this is the real grid-planning problem. Operators don't plan for the average day; they build margin for the bad one. A city tuned perfectly to the expected day that collapses in a heat wave teaches *planning under uncertainty* — resilience is margin for variability, not optimization for the mean.

---

## 3. The simulation model (dev-critical — this is the heart)

### 3.1 Time
- One day = **24 hourly steps** (`t = 0…23`), animated as a smooth curve.
- "Advance a day" re-runs the dispatch for the next day's weather.

### 3.2 Demand
Each building has a **normalized hourly load shape** (a 24-value array that sums to 1) multiplied by its **daily total** in game units.

```
load(building, t) = dailyTotal(building) × shape(building)[t] × tempMultiplier(t)
D(t) = Σ load(building, t)   // total city demand at hour t
```

Shapes (qualitative — generate smooth curves to match):

| Building | Daily total | Shape |
|---|---|---|
| House | 3 | Evening-peaking. Low overnight, small 7–8am bump, big ramp 5–9pm, peak ~7pm. *The problem child.* |
| House (WFH) | ~3.75 | House shape **plus a daytime plateau** 9am–5pm (AC + compute). Load now overlaps solar — self-covers *if* it has panels, piles onto the peak if not. |
| Office | 6 | Daytime. ~8am–6pm, peak midday/afternoon, ~0 at night. *Lines up with solar — the good citizen.* |
| Grocery | ~5 | Flat refrigeration baseload that **never hits zero** (~0.15/hr floor) + open-hours bump. *Teaches baseload.* |
| Data center *(hard)* | 12 gross | **Flat and high, 24/7** (~0.5/hr). Indifferent to time. Bundled solar (8/day) offsets midday; nights pull hard. *(Universal DC solar is an intentional aspirational choice — §12.)* |

### 3.3 Supply
- **Solar** — bell curve, zero before ~6am and after ~7pm, peak ~12–1pm. Killed by cloud lever. Zero carbon.
- **Battery** — `capacity` (stored units), `powerRate` (max units/hr), and **round-trip efficiency ~0.90** (§3.3a). Charges only from solar surplus, so it's effectively clean.
- **Utility baseload** — firm supply up to `U_cap`. **Not automatically clean** — its carbon intensity is set by the renewable mix (§3.8). A dirty baseload running all day emits heavily even with the peaker off.
- **Peaker** — fires only for demand above baseload, up to `Peak_cap`. Expensive and high-carbon, but **not the only source of carbon** (§3.8). The hero *reliability/cost* metric to shrink — carbon is a separate story.

#### 3.3a Battery round-trip efficiency
Real storage loses ~10% per charge/discharge cycle. Model one constant `ROUND_TRIP_EFF ≈ 0.90`: energy delivered on discharge = stored × `ROUND_TRIP_EFF` — put 10 in, get ~9 usable back. It's a **per-cycle tax, not decay**: each new batch pays the ~10% once, energy already stored is never re-taxed, and the battery never shrinks over time (no aging, no self-discharge in v1). Teaching value: time-shifting isn't free, so direct solar use beats storing when both are options.

### 3.4 Hourly dispatch (merit order — run every hour `t`)
This is real grid logic: serve demand from cheapest/cleanest to last resort.

```
1. SOLAR        served = min(D, Solar(t)); surplus = Solar(t) − served
2. CHARGE BATT  charge battery from surplus, limited by powerRate & remaining capacity
                leftover surplus → CURTAILED (wasted — surface this)
3. DISCHARGE    battery covers remaining demand; energy delivered = drawn × ROUND_TRIP_EFF,
                limited by powerRate & charge level
4. UTILITY      cover remaining demand up to U_cap
5. PEAKER       cover remaining demand up to Peak_cap  → this hour's PEAKER ENERGY
6. SHORTFALL    anything still unmet → BROWNOUT this hour
```

### 3.5 Brownout + priority load shedding
When `shortfall(t) > 0`, the grid can't serve every building that hour. Rather than dimming the whole grid equally, it **sheds whole buildings by priority tier**, lowest-priority first, until supply ≥ remaining demand. This is real utility practice — rolling blackouts run off a pre-set **Emergency Load Reduction Plan**, a literal ordered list of circuits to drop.

Default tier order — **shed first → shed last:**
`house → office → grocery (critical refrigeration baseload)`
So on a short hour you see houses go dark while the grocery stays lit — legible and true to life. *(Real plans protect life-safety loads like hospitals last; a hospital tier slots in above grocery later.)*

- `perBuildingHoursLost` is a **per-building counter** (sum, over buildings, of hours that building was dark) — **not** `shortfallHours × n`.
- Report it human-legibly, e.g. "3 houses lost power for 2 hours."
- **Future — Operations mode:** let the player *re-order the tiers themselves* (play utility operator setting the Emergency Load Reduction Plan), and optionally shed *flexible load first* (defer EV charging, dim AC) before cutting whole buildings — real demand-response before rolling blackout. Tagged future; **not v1** (v1 ships the fixed default order above).

**Off-grid case is not special:** removing the utility just sets `U_cap = 0` and `Peak_cap = 0`. Now `supply(t) = solar(t) + battery(t)`. Daytime is fine; overnight the battery is the only thing between the city and a blackout. Undersize it → empty at 3am → brownout. The lesson falls out of the formula for free. *(Gated behind the off-grid waiver — see §5.)*

### 3.6 Metrics (the soft-objective dashboard)
- **Reliability** — brownout hours + per-building hours lost. *The guardrail.*
- **Peaker energy** — Σ step-5 output. *The reliability/cost hero metric.*
- **Carbon (CO₂)** — per-source, **not** peaker-only (§3.8). Shown as a total against a **"good" benchmark**, with **no source breakdown** — so the player has to *discover* where it's coming from. A city optimized to never fire the peaker but running a 30%-renewable grid all day still reads dirty.
- **Cost ($)** — per-source tally (peaker expensive, baseload cheaper, DER ~free). A readout, not a market signal (markets = future, §12).
- **Reserve margin** — spare headroom at the peak after the day's contingency (§3.9). *Teaches resilience: did you leave room for the bad day?*
- **Curtailment** — wasted solar surplus. *Teaches why storage matters via negative space.*
- **Ghost/baseline line** — yesterday's value next to today's so the player feels their impact ("peaker: 7 → 3").
- **Estimate vs actual** — the day's actual outcome shown against the pre-run estimate (§3.7).

### 3.7 Weather: expected vs actual (drives the plan/reveal split)
The temperature and cloud **levers set a climate baseline** — "what kind of season this is" — not a fixed day.
- **Estimate (build mode):** dispatch runs on the *expected* day — baseline weather, no randomness — so the estimate is stable while you build.
- **Actual (Run Day):** weather is **sampled around the baseline** — a specific day that may be hotter or cloudier than expected. Dispatch runs on that, and the result can differ from the estimate. That gap is the lesson.
- Model the day's weather as a small number of **intraday segments (~5–6)** that can shift — clear morning, cloud bank rolls in mid-afternoon, clears by evening — rather than 24 independent random values. Weather moves in fronts, not hourly noise; more legible *and* more realistic. The energy engine still computes all 24 hours underneath.
- Variability magnitude is a tuning knob: enough that a marginal plan sometimes fails, not so much that good planning feels pointless.
- **Season** is part of the climate baseline. *Summer:* cooling-driven, single evening peak, long strong solar. *Winter:* heating-driven, **dual peak** (morning + evening), short weak solar — and electrification (heat pumps, EVs) makes winter peaks a real, growing problem. Winter days show a grid solar alone can't save.

### 3.8 Carbon & cost (per-source — decoupled from the peaker)
Each source has an intensity; the day's totals sum source energy × intensity.
- **Solar, battery** → ~0 carbon (battery charges from solar surplus).
- **Utility baseload** → carbon intensity is a **function of the renewable-mix lever**. 30% renewable = high intensity; 90% = low. This is the key move: baseload is *not* free carbon.
- **Peaker** → high constant intensity (gas).
- **"Good" benchmark** = emissions of the same daily demand served by a clean supply (high-renewable grid + solar) — the achievable floor for a city that size. Shown as "CO₂ 18 / good ≤ 6."
- **Hidden attribution (design rule):** the dashboard shows the CO₂ *total and benchmark only* — never a per-source breakdown. The player discovers that zeroing the peaker isn't the same as decarbonizing; cleaning the grid mix and displacing grid draw with their own solar is what moves it. Discovery is the lesson.
- Cost uses the same per-source approach (peaker expensive); making price *drive dispatch* (LMPs, demand charges, DR payments) is future (§12).

### 3.9 Reserve margin & daily contingency
Real grids don't run to the last unit — they hold spare capacity for contingencies, and shedding is the last rung.
- **Daily contingency roll:** at day start, randomly derate available capacity (a unit trips, a neighbor leans on the grid) and/or spike demand. Rolled with the weather (§3.7) and shown as the day's *starting headroom*.
- **Reserve margin (end-of-day metric):** `(availableCapacity − peakNetDemand) / peakNetDemand` at the peak hour, where availableCapacity includes utility + peaker + dispatchable DER (battery/VPP). Negative → you shed (brownout). Thin → survived but cut it close. Healthy → resilient.
- **Multi-day trend:** track reserve across days so the player sees whether their choices *build* margin (DERs, cleaner firmer grid) or *erode* it (adding load without headroom). Reinforces the plan-for-the-bad-day lesson.

---

## 4. Levers (player controls, top-level)
| Lever | Effect in the formula |
|---|---|
| **Temperature** | Sets the climate baseline for cooling load; the actual day samples around it (§3.7). Hotter → bigger afternoon/evening `D(t)`. |
| **Cloud cover / sunshine** | Sets baseline solar availability; the actual day samples around it. Cloudier → less `Solar(t)`. |
| **Season** | Summer (evening peak, strong solar) vs winter (dual morning/evening peak, weak solar) — §3.7. |
| **Utility modernization** *(shown as "renewable mix %")* | Scales `U_cap` + `Peak_cap` **and sets baseload carbon intensity** (§3.8) — a dirty grid emits even with the peaker off. Low % = old, capacity-constrained, dirty fleet → browns out on hot evenings. High % = firm clean capacity + storage → serves the peak. |

> **Design note (defend this in the portfolio):** "more renewable" does **not** automatically mean fewer brownouts — a solar-heavy grid with no storage browns out *more* at the evening peak. We model the lever as modernization-incl-storage so "less renewable → more brownouts" holds true *and* stays physically honest. The killer scenario: a green utility that skipped storage still browns out at peak — which is exactly why player-side DERs matter.

---

## 5. Player actions
- Place / remove buildings (house, WFH house, office, grocery; +gas station med; +data center hard).
- Flip a roof: add/remove **solar** (rooftop) — house 3 → ~1.
- Place **battery** (own grid square; visibly charges/discharges).
- Place standalone **solar** (own grid square).
- Switch a house's car: **gas → EV** *(medium)*; set EV charge window (6pm = worsens peak; midday/overnight = helps); optional V2G turns EV into a mini-battery.
- **Remove the utility** → triggers the **off-grid waiver modal**:
  > *"Going off-grid means moving outside city limits — most utilities require connection for occupied buildings. Your city will run on solar + storage alone. If the batteries drain overnight, the lights go out. [Sign waiver]"*
  Signing sets `U_cap = Peak_cap = 0`.

---

## 6. Visualization
- **Grid-based city** (Signal Grid aesthetic). Buildings and equipment occupy squares; solar panels and batteries each take a square.
- **Animated flow arrows** during the day:
  - utility → each building (pull from grid)
  - solar → battery (charging)
  - battery → house (discharge / "house runs on battery now")
  - arrow thickness or pulse ∝ flow magnitude
- **Hover tags** on every entity, including `(wfh)` for work-from-home houses. ~30% of houses default to WFH.
- **Build-mode estimate readout** — a live "expected day" panel that updates as you place pieces, before committing to a run.
- **Dashboard**: reliability / peaker energy / $ / CO₂ (actual vs estimate), each with the ghost baseline.
- **Curtailment indicator** when midday solar spills with no battery to catch it.
- **Grid-emergency event** *(hard mode set piece)*: on the hottest day the utility "calls the VPP" and every enrolled battery/EV discharges at once — the clearest possible picture of aggregated DER value.

---

## 7. Mode progression (build order)
- **EASY — vertical slice (build this first; it contains everything interesting):** houses, WFH houses, office, grocery, utility + peaker, solar, battery, the VPP-emergence behavior, all three levers, full dashboard, off-grid waiver. Starting city: 5 houses, 1 grocery, 1 office.
- **MEDIUM — additive layer:** gas stations; gas→EV swap + charge-window lever; bigger starting city.
- **HARD — additive layer:** data center (with bundled solar); grid-emergency / VPP-call event.

> **VPP is emergent, not a placeable.** It's what appears once several batteries/EVs exist: the utility dispatches them together at peak *before* firing the peaker. That's the "virtual plant."

---

## 8. Numbers to calibrate (proposed starting values — tune in playtest)
All abstract game units. None need real-world accuracy; relative *shape* is what teaches.

| Item | Starting value |
|---|---|
| House (no solar) | 3/day |
| House (with solar) | net ~1/day (solar offsets ~2) |
| WFH house | ~3.75/day |
| Office | 6/day |
| Grocery | ~5/day (with ~0.15/hr floor) |
| Data center | 12 gross / 8 solar / 4 net |
| Rooftop solar unit | ~2/day produced |
| Battery | capacity ~2 units, powerRate ~0.5/hr |
| Utility + peaker caps | set by modernization lever |
| Battery round-trip efficiency | ~0.90 (10 in → 9 out) |
| Baseload carbon intensity | scales with renewable mix (high at 30%, low at 90%) |
| Peaker carbon intensity | high constant |
| Daily contingency | randomly derate capacity ~5–20% and/or a small demand spike |

**Calibration anchor:** at 30% renewable, no DERs, temperature ≥ 80°F → the starting city must brown out for **~2 hours in the evening**. Tune `U_cap + Peak_cap` so the hot-evening peak exceeds total supply for ~2 hours. Everything else tunes around this anchor.

---

## 9. Dev handover (for Claude Code)
- **Stack:** single-page client-side app, React preferred (fits your portfolio + GitHub Pages/Vercel deploy). No backend needed — the sim is pure client-side math.
- **State:** city layout (grid of placed entities), per-entity config (solar y/n, EV charge window), lever values, current day, yesterday's metrics for the ghost line. localStorage optional for "save my city."
- **Engine module (build + unit-test this first, before any UI):**
  - `shapes.js` — the normalized 24h curves per building/solar.
  - `weather.js` — `expectedWeather(climate)` for the estimate (deterministic); `sampleWeather(climate, seed)` for actual runs (§3.7).
  - `dispatch.js` — the §3.4 hourly merit-order loop + §3.5 building-tier shedding, taking `weather` as input and returning `{served, peakerEnergy, shortfall, curtailment, batteryTimeline, perBuildingHoursLost, shedBuildingIds}`.
  - `metrics.js` — roll-ups for the dashboard, including estimate-vs-actual.
  - Test against the §8 calibration anchor (run **deterministic** — weather randomness off) as the first passing case.
- **Then UI:** grid placement → day animation + flow arrows → dashboard → levers → waiver modal.
- **Build phases:** (1) engine + console-verified anchor, (2) static grid + dashboard, (3) day animation + arrows, (4) levers + interactions, (5) Easy mode complete, (6) Medium, (7) Hard.

---

## 10. Optional Cowork research (not blocking)
If you want the curve shapes grounded rather than hand-drawn: residential vs commercial vs data-center daily load profiles, a typical solar generation curve, and rough NYC/ConEd peaker-firing timing. Purely flavor accuracy — the sim works without it, and "tune in playtest" covers the gap.

---

## 11. Open decisions parked for v1 (intentionally simple)
- **Free placement**, cost shown as a readout only (no budget). Friction-free for an uninformed player.
- **Wiring is abstract** — everything auto-connects; arrows are visualization, not a puzzle.
- **Weather** now drives the plan/reveal split (§3.7): levers set the climate baseline, each Run Day samples an actual day around it so estimate ≠ outcome. *(Replaces the earlier "sliders = fixed day" plan.)*
- **Operations mode** (player re-orders load-shed priority tiers; flexible-load shedding before rolling blackouts) — real and compelling, tagged **future**, not v1 (§3.5).
- **Benchmarks** = the live build-mode estimate is the primary "am I on track" signal; a small set of optional named challenge targets ("power a heat wave with zero brownouts," "peaker to zero") can layer on later.

---

## 12. Simplifications & roadmap (portfolio-facing)
*A short version of this belongs on the site. Naming a simplification reads as expertise; an unlabeled wrong thing reads as a gap.*

**Intentional simplifications (these are choices, not blind spots):**
- **No network topology / location is abstracted.** Quantity matters, placement doesn't. In reality DER value is *locational* (a battery behind a constrained substation defers a wires upgrade — the non-wires-alternative). Biggest "what I'd build next."
- **All data centers have on-site solar.** Not the 2026 reality (new DC load is chasing gas/nuclear PPAs). Kept deliberately as an *aspirational* design — the world I'd build toward, where DC load is offset at the source.
- **Cost is a readout, not a market.** Dispatch follows a physical merit order, not prices.
- **Energy-balance "brownout."** A real brownout is a *voltage* reduction; here it's an energy shortfall. No voltage/frequency layer, no T&D losses (~5% IRL).
- **Carbon is a per-source proxy**, not real time-varying marginal emissions — but it *is* decoupled from the peaker (§3.8), which is the part that matters pedagogically.

**Roadmap / what I'd build next:**
1. **Locational value + network topology** — the non-wires-alternative argument. The strongest DER story.
2. **Price signals / markets** — LMPs, demand charges, TOU, DR payments that actually *drive* dispatch.
3. **Demand response as a gentle layer** — enrolled, automated, paid device flexing (defer EV charging, cycle AC) — distinct from emergency shedding, same family as the VPP. *This is the "EV-before-AC" mechanic, correctly modeled.*
4. **Operations mode** — player sets the Emergency Load Reduction Plan tiers (§3.5).
5. **Deeper seasons** — winter/dual-peak and electrification stress.
