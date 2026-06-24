// Normalized 24-hour load/solar curves. Each array sums to 1.
// Hour 0 = midnight, 12 = noon, 23 = 11pm.

const RAW = {
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

function normalize(arr) {
  const sum = arr.reduce((a, b) => a + b, 0)
  return arr.map(v => v / sum)
}

export const LOAD_SHAPES = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k, normalize(v)])
)

// Bell curve centered on hour 13 (accounts for thermal lag vs solar noon)
function makeSolarShape() {
  const raw = Array(24).fill(0)
  for (let h = 6; h <= 19; h++) {
    const x = (h - 13) / 4.5
    raw[h] = Math.exp(-0.5 * x * x)
  }
  return normalize(raw)
}

export const SOLAR_SHAPE = makeSolarShape()

export function getLoadShape(type) {
  const s = LOAD_SHAPES[type]
  if (!s) throw new Error(`Unknown building type: ${type}`)
  return s
}

export function getSolarShape() { return SOLAR_SHAPE }
