import { getLoadShape, getSolarShape } from './shapes.js'

// Energy units (EU) per day per building at baseline (72°F, 0% modernization)
const BUILDING_DAILY = { house: 6, wfh_house: 7.5, office: 12, grocery: 10 }
const TEMP_AFFECTED  = new Set(['house', 'wfh_house', 'grocery'])

const SOLAR_DAILY    = 8     // EU/day per solar unit at full sun
const TEMP_THRESHOLD = 72    // °F — below this no AC load
const TEMP_COEFF     = 0.025 // fractional load increase per °F above threshold

// Grid caps — tuned to calibration anchor (§8): ~2 brownouts at hours 17–18
export const U_CAP    = 3.1  // utility grid max EU/hour
export const PEAK_CAP = 0.5  // peaker supplement max EU/hour

export function runDay({
  buildings,
  solarUnits = [],
  batteries  = [],
  uCap       = U_CAP,
  peakCap    = PEAK_CAP,
  levers     = {},
}) {
  const { temperature = 72, cloudCover = 0, modernization = 30 } = levers
  const modFactor  = 1 - (modernization / 100) * 0.15
  const tempDelta  = Math.max(0, temperature - TEMP_THRESHOLD)
  const solarScale = 1 - cloudCover / 100
  const solarShape = getSolarShape()
  const totalSolar = solarUnits.reduce((s, u) => s + u, 0) * SOLAR_DAILY

  // Batteries start at 50% — charged from grid overnight in real operation
  const charge = batteries.map(b => b.capacity * 0.5)

  const hourly = []
  let peakerEnergy = 0, brownoutHours = 0, buildingHoursLost = 0, totalCurtailment = 0

  for (let t = 0; t < 24; t++) {
    // Thermal mass means AC load peaks in evening, not just when it's hottest outside
    const timeFactor = (t >= 16 && t <= 21) ? 1.3 : (t >= 7 ? 0.9 : 0.5)
    const acMult     = 1 + tempDelta * TEMP_COEFF * timeFactor

    let demand = 0
    for (const b of buildings) {
      if (b.type === 'utility' || b.type === 'peaker') continue  // infrastructure, not demand
      const shape   = getLoadShape(b.type)
      const daily   = BUILDING_DAILY[b.type] ?? 6
      const tempMod = TEMP_AFFECTED.has(b.type) ? acMult : 1
      demand += daily * shape[t] * tempMod * modFactor
    }

    // Merit order: solar → charge batteries from excess → utility → battery discharge → peaker → shortfall

    // 1. Solar serves demand first
    const solarGen  = totalSolar * solarShape[t] * solarScale
    const solarUsed = Math.min(solarGen, demand)
    let   remaining = demand - solarUsed
    let   solarEx   = solarGen - solarUsed

    // 2. Excess solar charges batteries
    let charged = 0
    for (let i = 0; i < batteries.length && solarEx > 0.001; i++) {
      const room = batteries[i].capacity - charge[i]
      const take = Math.min(solarEx, batteries[i].capacity, room)
      charge[i] += take
      charged   += take
      solarEx   -= take
    }
    const curtailment = Math.max(0, solarEx)
    totalCurtailment += curtailment

    // 3. Utility grid (cheap baseload)
    const utility = Math.min(remaining, uCap)
    remaining -= utility

    // 4. Battery discharge covers what utility couldn't
    let discharged = 0
    for (let i = 0; i < batteries.length && remaining > 0.001; i++) {
      const give  = Math.min(remaining, batteries[i].capacity, charge[i])
      charge[i]  -= give
      discharged += give
      remaining  -= give
    }

    // 5. Peaker (expensive, last resort)
    const peaker = Math.min(remaining, peakCap)
    remaining   -= peaker
    peakerEnergy += peaker

    // 6. Shortfall = brownout
    const shortfall = Math.max(0, remaining)
    if (shortfall > 0.001) {
      brownoutHours++
      buildingHoursLost += buildings.length
    }

    hourly.push({
      t, demand,
      solarServed: solarUsed, batteryCharge: charged, batteryDischarge: discharged,
      utility, peaker, shortfall, curtailment,
    })
  }

  return {
    hourly,
    totals: { peakerEnergy, brownoutHours, buildingHoursLost, curtailment: totalCurtailment },
  }
}
