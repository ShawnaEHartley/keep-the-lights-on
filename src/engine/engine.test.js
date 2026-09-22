import { describe, it, expect } from 'vitest'
import { runDay } from './dispatch.js'
import { expectedWeather } from './weather.js'
import { ROUND_TRIP_EFF } from './constants.js'
import { deriveHouseTypes } from '../state/cityModel.js'

// ── Calibration anchor (spec §8, revised) ────────────────────────────────────
// Deterministic (expectedWeather), no randomness.
// 5 houses + 1 grocery + 1 office + 1 utility + 1 peaker, no DERs,
// modernization 30%, temp 80°F.
//
// The anchor used to assert ~2 brownout hours. It now asserts the opposite:
// the city STAYS LIT and pays for it by running the gas peaker through the
// evening peak. US households overwhelmingly experience price and emissions,
// not outages — so the peaker, not the blackout, is the failure the game is
// built to make visible. Blackouts are reserved for genuine extremis
// (off-grid, or no peaker), covered by their own tests below.

// Run through deriveHouseTypes so the anchor is the city the player actually
// sees — roughly 1 in 5 houses is work-from-home, which draws more at midday.
const DEMAND_BUILDINGS = deriveHouseTypes([
  { id: 1, type: 'house'   },
  { id: 2, type: 'house'   },
  { id: 3, type: 'house'   },
  { id: 4, type: 'house'   },
  { id: 5, type: 'house'   },
  { id: 6, type: 'grocery' },
  { id: 7, type: 'office'  },
])
const INFRA = [
  { id: 8, type: 'utility' },
  { id: 9, type: 'peaker'  },
]
const ANCHOR_BUILDINGS = [...DEMAND_BUILDINGS, ...INFRA]
const ANCHOR_WEATHER = expectedWeather({ temperature: 80, cloudCover: 0, season: 'summer', modernization: 30 })

describe('calibration anchor', () => {
  it('keeps the starting city lit — no blackouts', () => {
    const result = runDay({ buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER })
    expect(result.totals.brownoutHours).toBe(0)
    expect(result.totals.perBuildingHoursLost).toBe(0)
  })

  it('runs the peaker through the evening peak to do it', () => {
    const result = runDay({ buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER })

    expect(result.totals.peakerHours).toBeGreaterThanOrEqual(2)
    expect(result.totals.peakerHours).toBeLessThanOrEqual(5)
    expect(result.totals.peakerEnergy).toBeGreaterThan(0)

    // Every peaker hour falls in the evening block
    const peakerRunHours = result.hourly.filter(h => h.peaker > 0.001).map(h => h.t)
    expect(peakerRunHours.length).toBeGreaterThan(0)
    for (const t of peakerRunHours) {
      expect(t).toBeGreaterThanOrEqual(15)
      expect(t).toBeLessThanOrEqual(22)
    }
  })

  it('has positive reserve margin — the city is not on the edge', () => {
    const result = runDay({ buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER })
    expect(result.totals.reserveMargin).toBeGreaterThan(0)
  })
})

describe('the peaker is what keeps the lights on', () => {
  it('removing the peaker turns evening peak into blackout', () => {
    const noPeaker = runDay({
      buildings: ANCHOR_BUILDINGS.filter(b => b.type !== 'peaker'),
      weather: ANCHOR_WEATHER,
    })
    expect(noPeaker.totals.brownoutHours).toBeGreaterThan(0)
    expect(noPeaker.totals.peakerEnergy).toBe(0)
  })

  it('adding a second peaker does not increase gas burned — demand is the driver', () => {
    const one = runDay({ buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER })
    const two = runDay({
      buildings: [...ANCHOR_BUILDINGS, { id: 10, type: 'peaker' }],
      weather: ANCHOR_WEATHER,
    })
    // Extra headroom, but nothing extra to serve
    expect(two.totals.peakerEnergy).toBeCloseTo(one.totals.peakerEnergy, 5)
    expect(two.totals.reserveMargin).toBeGreaterThan(one.totals.reserveMargin)
  })

  it('modernizing the grid quiets the peaker', () => {
    const dirty = runDay({ buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER })
    const clean = runDay({
      buildings: ANCHOR_BUILDINGS,
      weather: expectedWeather({ temperature: 80, cloudCover: 0, season: 'summer', modernization: 90 }),
    })
    expect(clean.totals.peakerEnergy).toBeLessThan(dirty.totals.peakerEnergy)
    expect(clean.totals.peakerHours).toBeLessThan(dirty.totals.peakerHours)
    expect(clean.totals.brownoutHours).toBe(0)
  })
})

describe('blackouts — last resort only', () => {
  it('off-grid with no storage goes dark', () => {
    const offGrid = runDay({ buildings: DEMAND_BUILDINGS, weather: ANCHOR_WEATHER })
    expect(offGrid.totals.brownoutHours).toBeGreaterThan(0)
  })

  it('sheds houses first — grocery stays lit', () => {
    // No peaker → the evening peak exceeds supply and shedding kicks in
    const result = runDay({
      buildings: ANCHOR_BUILDINGS.filter(b => b.type !== 'peaker'),
      weather: ANCHOR_WEATHER,
    })
    const shedHours = result.hourly.filter(h => h.shedBuildingIds.length > 0)
    expect(shedHours.length).toBeGreaterThan(0)

    for (const h of shedHours) {
      const housesShed = h.shedBuildingIds.some(id => id >= 1 && id <= 5)
      if (housesShed) {
        expect(h.shedBuildingIds).not.toContain(6)  // grocery (id 6) stays lit
      }
    }
  })

  it('perBuildingHoursLost counts shed buildings, not grid × brownoutHours', () => {
    const result = runDay({
      buildings: ANCHOR_BUILDINGS.filter(b => b.type !== 'peaker'),
      weather: ANCHOR_WEATHER,
    })
    const { brownoutHours, perBuildingHoursLost } = result.totals
    expect(perBuildingHoursLost).toBeGreaterThan(0)
    expect(perBuildingHoursLost).toBeLessThan(brownoutHours * DEMAND_BUILDINGS.length)
  })
})

describe('supply features', () => {
  it('adding a battery reduces peaker energy or brownout hours', () => {
    const without = runDay({ buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER, batteries: [] })
    const withBat = runDay({
      buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER,
      batteries: [{ capacity: 2, powerRate: 0.5 }],
    })
    const sumBefore = without.totals.peakerEnergy + without.totals.brownoutHours
    const sumAfter  = withBat.totals.peakerEnergy + withBat.totals.brownoutHours
    expect(sumAfter).toBeLessThan(sumBefore)
  })

  it('all-solar roofs with no battery produces midday curtailment', () => {
    const result = runDay({
      buildings: [
        { id: 1, type: 'house' }, { id: 2, type: 'house' },
        { id: 3, type: 'house' }, { id: 4, type: 'house' },
        { id: 5, type: 'house' },
        ...INFRA,
      ],
      solarUnits: [1, 1, 1, 1, 1],
      batteries: [],
      weather: expectedWeather({ temperature: 72, cloudCover: 0, season: 'summer', modernization: 30 }),
    })
    expect(result.totals.curtailment).toBeGreaterThan(0)
  })

  it('adding a battery to solar reduces curtailment', () => {
    const base = {
      buildings: [
        { id: 1, type: 'house' }, { id: 2, type: 'house' },
        { id: 3, type: 'house' }, { id: 4, type: 'house' },
        { id: 5, type: 'house' },
        ...INFRA,
      ],
      solarUnits: [1, 1, 1, 1, 1],
      weather: expectedWeather({ temperature: 72, cloudCover: 0, season: 'summer', modernization: 30 }),
    }
    const without = runDay({ ...base, batteries: [] })
    const withBat = runDay({ ...base, batteries: [{ capacity: 2, powerRate: 0.5 }] })
    expect(withBat.totals.curtailment).toBeLessThan(without.totals.curtailment)
  })

  it('battery round-trip efficiency: deliver ≈ stored × 0.90', () => {
    // Deliberately off-grid (no utility tile) so the battery is the only thing
    // carrying the overnight load and actually has to discharge.
    const result = runDay({
      buildings: [{ id: 1, type: 'house' }],
      solarUnits: [3],
      batteries: [{ capacity: 4, powerRate: 4 }],
      weather: expectedWeather({ temperature: 72, cloudCover: 0, season: 'summer', modernization: 30 }),
    })
    const totalCharged    = result.hourly.reduce((s, h) => s + h.batteryCharge,    0)
    const totalDischarged = result.hourly.reduce((s, h) => s + h.batteryDischarge, 0)

    expect(totalCharged).toBeGreaterThan(0.1)
    expect(totalDischarged).toBeLessThanOrEqual(totalCharged * ROUND_TRIP_EFF + 0.01)
  })
})

describe('carbon decoupling', () => {
  it('zero peaker energy on a well-supplied grid still has non-zero baseload energy', () => {
    const result = runDay({
      buildings: ANCHOR_BUILDINGS,
      weather: expectedWeather({ temperature: 72, cloudCover: 0, season: 'summer', modernization: 100 }),
    })
    expect(result.totals.energyBySource.peaker).toBeLessThan(0.01)
    expect(result.totals.energyBySource.baseload).toBeGreaterThan(5)
  })
})

describe('reserve margin', () => {
  it('goes negative when the city loses its supply', () => {
    const offGrid = runDay({ buildings: DEMAND_BUILDINGS, weather: ANCHOR_WEATHER })
    expect(offGrid.totals.reserveMargin).toBeLessThan(0)
  })

  it('improves when modernization increases supply', () => {
    const low  = runDay({ buildings: ANCHOR_BUILDINGS, weather: expectedWeather({ temperature: 80, modernization: 30  }) })
    const high = runDay({ buildings: ANCHOR_BUILDINGS, weather: expectedWeather({ temperature: 80, modernization: 100 }) })
    expect(high.totals.reserveMargin).toBeGreaterThan(low.totals.reserveMargin)
  })
})
