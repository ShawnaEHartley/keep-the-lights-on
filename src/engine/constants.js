// Shared constants. All domain-specific magic numbers live here.

export const ROUND_TRIP_EFF = 0.90         // battery: 10 in → 9 out, per-cycle, discharge side
export const SOLAR_DAILY    = 2            // EU/day per rooftop solar unit at full summer sun

// Carbon intensities (kg CO₂ / EU)
export const PEAKER_CARBON  = 2.0          // gas peaker — high constant
export const SOLAR_CARBON   = 0.0
export const BATTERY_CARBON = 0.0          // charges from solar surplus only

// Baseload carbon scales with renewable mix: dirty at 30%, clean at 90%
export function baseloadCarbon(renewableMix) {
  const pct = Math.max(0, Math.min(100, renewableMix)) / 100
  return 1.0 - pct * 0.9                  // 0% → 1.0, 30% → 0.73, 90% → 0.19, 100% → 0.10
}

// "Good" benchmark: same demand served by a clean supply (high-renewable grid + own solar)
export const BENCHMARK_CARBON = 0.10       // kg CO₂ / EU

// Per-source costs (readout only — no dispatch signal in v1)
export const UTILITY_COST = 0.80           // $ / EU
export const PEAKER_COST  = 2.00           // $ / EU

// Per-unit supply capacity. Total grid capacity = these × how many utility /
// peaker tiles the city actually has, so removing the utility takes you
// off-grid and adding a peaker buys headroom.
//
// Calibration: at 30% mix, temp=80°F, the anchor city (5 house + grocery +
// office) peaks at ~1.97 EU/hr. One utility (1.80) cannot cover that alone —
// the peaker picks up the evening shoulder, which is the point. One utility
// plus one peaker (2.80) covers it with room for a bad contingency roll, so
// the city stays lit and pays for it in gas instead.
export function capsFromModernization(modernization) {
  const m = Math.max(0, Math.min(100, modernization))
  return {
    // Cleaner grid → more baseload headroom, so the peaker is needed less.
    uCapPerUtility:   Math.max(0.3, 1.80 + (m - 30) * 0.025),
    // A gas plant's nameplate doesn't change with the grid mix — only how
    // often it has to run. Holding this constant is what lets modernization
    // visibly quiet the peaker.
    peakCapPerPeaker: PEAKER_CAP_PER_UNIT,
  }
}

export const PEAKER_CAP_PER_UNIT = 1.0

// Daily contingency ranges for sampleWeather (spec §3.9)
export const CONTINGENCY = {
  derateMin:      0.05,   // 5 % minimum capacity reduction
  derateMax:      0.20,   // 20% maximum capacity reduction
  demandSpikeMax: 0.10,   // 0–10% extra demand
}
