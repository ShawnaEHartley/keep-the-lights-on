import { capsFromModernization, CONTINGENCY } from './constants.js'

// Seeded LCG PRNG — reproducible randomness for tests and re-play
function makePRNG(seed) {
  let s = ((seed >>> 0) || 1)
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0
    return (s >>> 0) / 0x100000000
  }
}

// Build a per-hour cloud-factor array (0 = clear, 1 = fully overcast)
// from an array of {start, end, cloud} segments
function segmentsToHours(segments) {
  const arr = new Array(24).fill(0)
  for (const { start, end, cloud } of segments) {
    for (let t = start; t <= end; t++) arr[t] = cloud
  }
  return arr
}

const HOUR_SEGMENTS = [[0,4],[5,8],[9,12],[13,16],[17,20],[21,23]]

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * expectedWeather(climate) — deterministic baseline used for the live estimate.
 * Flat cloud cover, no contingency derate, no demand spike.
 * climate: { temperature, cloudCover, season, modernization }
 */
export function expectedWeather(climate = {}) {
  const {
    temperature  = 80,
    cloudCover   = 0,
    season       = 'summer',
    modernization = 30,
  } = climate

  const { uCapPerUtility, peakCapPerPeaker } = capsFromModernization(modernization)
  const cloud = cloudCover / 100

  return {
    temperature,
    season,
    uCapPerUtility,
    peakCapPerPeaker,
    contingencyFactor: 1.0,
    demandSpikeFactor: 1.0,
    solarDailyFactor:  season === 'winter' ? 0.5 : 1.0,
    cloudByHour: new Array(24).fill(cloud),
  }
}

/**
 * sampleWeather(climate, seed) — randomised day for Run Day reveal.
 * ~5–6 intraday cloud segments vary around the baseline; daily contingency
 * derate reduces available capacity (spec §3.7, §3.9).
 */
export function sampleWeather(climate = {}, seed = Date.now()) {
  const {
    temperature  = 80,
    cloudCover   = 0,
    season       = 'summer',
    modernization = 30,
  } = climate

  const rng = makePRNG(seed)
  const { uCapPerUtility, peakCapPerPeaker } = capsFromModernization(modernization)

  // Daily temperature variance ±5°F around baseline
  const actualTemp = temperature + (rng() - 0.5) * 10

  // Intraday cloud segments: each varies ±0.25 around baseline, clamped [0,1]
  const baseCloud = cloudCover / 100
  const cloudByHour = segmentsToHours(
    HOUR_SEGMENTS.map(([start, end]) => ({
      start, end,
      cloud: Math.max(0, Math.min(1, baseCloud + (rng() - 0.5) * 0.5)),
    }))
  )

  // Daily contingency: capacity derate + possible demand spike
  const derateRange    = CONTINGENCY.derateMax - CONTINGENCY.derateMin
  const contingency    = 1 - (CONTINGENCY.derateMin + rng() * derateRange)
  const demandSpike    = 1 + rng() * CONTINGENCY.demandSpikeMax

  return {
    temperature:       actualTemp,
    season,
    uCapPerUtility:    uCapPerUtility   * contingency,
    peakCapPerPeaker:  peakCapPerPeaker * contingency,
    contingencyFactor: contingency,
    demandSpikeFactor: demandSpike,
    solarDailyFactor:  (season === 'winter' ? 0.5 : 1.0) * (1 - rng() * 0.2),
    cloudByHour,
  }
}
