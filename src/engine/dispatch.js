import { getLoadShape, getSolarShape } from './shapes.js'
import { ROUND_TRIP_EFF, SOLAR_DAILY } from './constants.js'

// Daily energy totals per building type (EU/day at baseline)
const BUILDING_DAILY = { house: 3, wfh_house: 3.75, office: 6, grocery: 5 }
const TEMP_AFFECTED  = new Set(['house', 'wfh_house', 'grocery'])
const INFRA_TYPES    = new Set(['utility', 'peaker'])

// Thermal mass: AC/heat load peaks in evening, not just at peak outdoor temp
const TEMP_THRESHOLD = 72     // °F — below this, no extra AC/heat load
const TEMP_COEFF     = 0.025  // fractional load increase per °F above threshold

// Shed lowest-priority buildings first (spec §3.5)
const SHED_ORDER = ['house', 'wfh_house', 'office', 'grocery']

// ── Main dispatch loop ────────────────────────────────────────────────────────

/**
 * runDay({ buildings, solarUnits, batteries, weather }) → { hourly, totals }
 *
 * weather comes from expectedWeather() (estimate) or sampleWeather() (Run Day).
 * buildings: array of { id, type, col, row }. Infrastructure types are ignored for demand.
 * solarUnits: array of numbers (each = 1 rooftop unit producing SOLAR_DAILY EU/day).
 * batteries: array of { capacity, powerRate? }. powerRate defaults to capacity.
 */
export function runDay({ buildings, solarUnits = [], batteries = [], weather = {} }) {
  const {
    temperature       = 72,
    season            = 'summer',
    cloudByHour       = new Array(24).fill(0),
    uCapPerUtility    = 1.8,
    peakCapPerPeaker  = 1.0,
    demandSpikeFactor = 1.0,
    solarDailyFactor  = 1.0,
  } = weather

  // Supply capacity comes from the infrastructure actually on the map. No
  // utility tile → uCap 0 → the city is off-grid and runs on what it built.
  const utilityCount = buildings.filter(b => b.type === 'utility').length
  const peakerCount  = buildings.filter(b => b.type === 'peaker').length
  const uCap    = uCapPerUtility   * utilityCount
  const peakCap = peakCapPerPeaker * peakerCount

  const tempDelta      = Math.max(0, temperature - TEMP_THRESHOLD)
  const solarShape     = getSolarShape(season)
  const totalSolarUnits = solarUnits.reduce((s, u) => s + u, 0)
  const dailySolarEU   = totalSolarUnits * SOLAR_DAILY * solarDailyFactor

  // Batteries start at 50% charge
  const charge = batteries.map(b => b.capacity * 0.5)

  // Demand-side buildings (non-infrastructure)
  const demandBuildings = buildings.filter(b => !INFRA_TYPES.has(b.type))

  const hourly = []
  let peakerEnergy = 0, peakerHours = 0, brownoutHours = 0, perBuildingHoursLost = 0
  let totalCurtailment = 0
  let totalSolar = 0, totalBattery = 0, totalBaseload = 0, totalPeaker = 0
  let peakNetDemand = 0, peakHour = 0, peakerPeakUse = 0

  for (let t = 0; t < 24; t++) {
    // Thermal mass: load peaks lag behind outdoor temp
    const timeFactor = (t >= 16 && t <= 21) ? 1.3 : (t >= 7 ? 0.9 : 0.5)
    const acMult     = 1 + tempDelta * TEMP_COEFF * timeFactor

    // Per-building demand at this hour
    const buildingDemands = demandBuildings.map(b => {
      const shape   = getLoadShape(b.type, season)
      const daily   = BUILDING_DAILY[b.type] ?? 3
      const tempMod = TEMP_AFFECTED.has(b.type) ? acMult : 1
      return { id: b.id, type: b.type, demand: daily * shape[t] * tempMod * demandSpikeFactor }
    })

    const totalDemand = buildingDemands.reduce((s, b) => s + b.demand, 0)
    if (totalDemand > peakNetDemand) { peakNetDemand = totalDemand; peakHour = t }

    // ── Merit order ────────────────────────────────────────────────────────

    // 1. Solar
    const solarGen  = dailySolarEU * solarShape[t] * (1 - cloudByHour[t])
    const solarUsed = Math.min(solarGen, totalDemand)
    let   remaining = totalDemand - solarUsed
    let   solarEx   = solarGen - solarUsed
    totalSolar     += solarUsed

    // 2. Charge batteries from solar surplus
    let charged = 0
    for (let i = 0; i < batteries.length && solarEx > 0.001; i++) {
      const room = batteries[i].capacity - charge[i]
      const take = Math.min(solarEx, room)
      charge[i] += take
      charged    += take
      solarEx    -= take
    }
    const curtailment = Math.max(0, solarEx)
    totalCurtailment += curtailment

    // 3. Utility baseload (firm supply; battery is held in reserve for peak)
    const utility = Math.min(remaining, uCap)
    remaining    -= utility
    totalBaseload += utility

    // 4. Battery discharge — fires after utility so stored charge is saved for peak hours
    //    (dispatch × ROUND_TRIP_EFF = energy delivered; battery charge falls by drawn amount)
    let discharged = 0
    for (let i = 0; i < batteries.length && remaining > 0.001; i++) {
      const rate    = batteries[i].powerRate ?? batteries[i].capacity
      const deliver = Math.min(remaining, rate, charge[i] * ROUND_TRIP_EFF)
      const drawn   = deliver / ROUND_TRIP_EFF
      charge[i]    -= drawn
      discharged   += deliver
      remaining    -= deliver
    }
    totalBattery += discharged

    // 5. Peaker
    const peaker = Math.min(remaining, peakCap)
    remaining   -= peaker
    peakerEnergy += peaker
    totalPeaker  += peaker
    // Hours-run is the headline the player can actually feel — fractional EU
    // moves too little to register (see the brief's unit-scale constraint).
    if (peaker > 0.001) peakerHours++
    peakerPeakUse = Math.max(peakerPeakUse, peaker)

    // 6. Shortfall → shed buildings by priority tier (spec §3.5)
    const rawShortfall  = Math.max(0, remaining)
    const shedBuildingIds = []

    if (rawShortfall > 0.001) {
      let residual = rawShortfall
      outer: for (const tierType of SHED_ORDER) {
        for (const bd of buildingDemands) {
          if (bd.type !== tierType) continue
          shedBuildingIds.push(bd.id)
          perBuildingHoursLost += 1
          residual -= bd.demand
          if (residual <= 0.001) break outer
        }
      }
      brownoutHours++  // any hour with shedding = brownout hour
    }

    hourly.push({
      t, demand: totalDemand,
      solarServed:      solarUsed,
      batteryCharge:    charged,
      batteryDischarge: discharged,
      utility, peaker,
      shortfall:     rawShortfall,
      curtailment,
      shedBuildingIds,
    })
  }

  // Reserve margin at the day's peak hour (spec §3.9)
  const availableCap   = uCap + peakCap
  const reserveMargin  = peakNetDemand > 0
    ? (availableCap - peakNetDemand) / peakNetDemand
    : 1

  return {
    hourly,
    totals: {
      peakerEnergy,
      peakerHours,
      brownoutHours,
      perBuildingHoursLost,
      curtailment: totalCurtailment,
      energyBySource: { solar: totalSolar, battery: totalBattery, baseload: totalBaseload, peaker: totalPeaker },
      reserveMargin,
      peakHour,
      uCap,
      peakCap,
      // Fraction of the whole peaker fleet in use at its busiest hour. Daily
      // totals would read ~2% and tell the player nothing; peak-hour use is
      // the number that means something.
      peakerPeakUtilization: peakCap > 0 ? peakerPeakUse / peakCap : 0,
    },
  }
}
