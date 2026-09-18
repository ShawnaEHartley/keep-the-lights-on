// Normalized 24-hour load/solar curves.
// Each array sums to 1 so dispatch multiplies by daily total.
// Hour 0 = midnight, 12 = noon, 23 = 11pm.

// ── Load shapes ──────────────────────────────────────────────────────────────

const SUMMER = {
  house: [
    30, 25, 22, 20, 20, 25,
    45, 65, 55, 45, 40, 42,
    45, 45, 50, 55, 65, 80,
    90, 85, 75, 65, 50, 38,
  ],
  wfh_house: [
    30, 25, 22, 20, 20, 25,
    45, 65, 65, 60, 58, 58,
    60, 58, 55, 58, 68, 82,
    90, 85, 75, 65, 50, 38,
  ],
  office: [
     5,  5,  5,  5,  5,  8,
    20, 45, 70, 85, 90, 90,
    80, 85, 90, 88, 80, 60,
    35, 20, 10,  8,  6,  5,
  ],
  grocery: [
    40, 38, 38, 38, 38, 40,
    45, 55, 65, 70, 72, 75,
    75, 75, 75, 73, 72, 72,
    72, 68, 60, 50, 45, 42,
  ],
}

// Winter: heating-driven dual peak (morning warm-up + evening return)
// Solar window shorter and weaker; handled via solarDailyFactor in weather.js
const WINTER = {
  // Bigger morning bump (6-9 heating), lower midday (empty house), same evening peak
  house: [
    30, 26, 23, 21, 21, 26,
    50, 72, 68, 50, 36, 30,
    28, 26, 28, 38, 58, 78,
    90, 85, 72, 58, 42, 32,
  ],
  // WFH: home all day heating; dual peak less pronounced since midday doesn't drop as much
  wfh_house: [
    30, 26, 23, 21, 21, 26,
    52, 74, 72, 65, 62, 60,
    62, 60, 60, 64, 70, 84,
    90, 85, 74, 62, 44, 32,
  ],
  // Office: stronger morning heat-up, similar peak, faster evening dropoff
  office: [
     5,  5,  5,  5,  5,  8,
    28, 55, 78, 88, 90, 90,
    84, 86, 88, 84, 72, 52,
    28, 14,  8,  6,  5,  5,
  ],
  // Grocery: refrigeration unaffected by season, same profile
  grocery: [
    40, 38, 38, 38, 38, 40,
    45, 55, 65, 70, 72, 75,
    75, 75, 75, 73, 72, 72,
    72, 68, 60, 50, 45, 42,
  ],
}

function normalize(arr) {
  const sum = arr.reduce((a, b) => a + b, 0)
  return arr.map(v => v / sum)
}

const SHAPES = {
  summer: Object.fromEntries(Object.entries(SUMMER).map(([k, v]) => [k, normalize(v)])),
  winter: Object.fromEntries(Object.entries(WINTER).map(([k, v]) => [k, normalize(v)])),
}

// ── Solar shapes ─────────────────────────────────────────────────────────────

// Summer: broad bell centered at hour 13 (thermal lag), window 6–19
function makeSummerSolar() {
  const raw = Array(24).fill(0)
  for (let h = 6; h <= 19; h++) {
    const x = (h - 13) / 4.5
    raw[h] = Math.exp(-0.5 * x * x)
  }
  return normalize(raw)
}

// Winter: narrower window (8–16), peaks at solar noon 12, lower amplitude per-hour
// Total seasonal production reduced via weather.solarDailyFactor (0.5 in winter)
function makeWinterSolar() {
  const raw = Array(24).fill(0)
  for (let h = 8; h <= 16; h++) {
    const x = (h - 12) / 2.8
    raw[h] = Math.exp(-0.5 * x * x)
  }
  return normalize(raw)
}

const SOLAR_SHAPES = {
  summer: makeSummerSolar(),
  winter: makeWinterSolar(),
}

// ── Exports ──────────────────────────────────────────────────────────────────

export function getLoadShape(type, season = 'summer') {
  const bank = SHAPES[season] ?? SHAPES.summer
  const s = bank[type]
  if (!s) throw new Error(`Unknown building type: ${type}`)
  return s
}

export function getSolarShape(season = 'summer') {
  return SOLAR_SHAPES[season] ?? SOLAR_SHAPES.summer
}
