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

// Grid capacity from renewable-mix (modernization) lever.
// Calibration: at 30%, temp=80°F the anchor city (5 house+grocery+office) peaks at ~1.97 EU/hr.
// uCap+peakCap=1.90 → sits between t=16 demand (1.849, no brownout) and t=17 (1.970, brownout).
export function capsFromModernization(modernization) {
  const m = Math.max(0, Math.min(100, modernization))
  return {
    uCap:    Math.max(0.3, 1.80 + (m - 30) * 0.025),
    peakCap: Math.max(0.0, 0.10 + (m - 30) * 0.004),
  }
}

// Daily contingency ranges for sampleWeather (spec §3.9)
export const CONTINGENCY = {
  derateMin:      0.05,   // 5 % minimum capacity reduction
  derateMax:      0.20,   // 20% maximum capacity reduction
  demandSpikeMax: 0.10,   // 0–10% extra demand
}
