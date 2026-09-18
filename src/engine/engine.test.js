import { describe, it, expect } from 'vitest'
import { runDay } from './dispatch.js'
import { expectedWeather } from './weather.js'
import { ROUND_TRIP_EFF } from './constants.js'

// Calibration anchor: deterministic (expectedWeather), no randomness.
// 5 houses + 1 grocery + 1 office, no DERs, modernization 30%, temp 80°F.
// Expected: brownoutHours ≈ 2, falls in the evening block, houses shed — grocery stays lit.

const ANCHOR_BUILDINGS = [
  { id: 1, type: 'house'   },
  { id: 2, type: 'house'   },
  { id: 3, type: 'house'   },
  { id: 4, type: 'house'   },
  { id: 5, type: 'house'   },
  { id: 6, type: 'grocery' },
  { id: 7, type: 'office'  },
]
const ANCHOR_WEATHER = expectedWeather({ temperature: 80, cloudCover: 0, season: 'summer', modernization: 30 })

describe('calibration anchor', () => {
  it('produces ~2 brownout hours in the evening with the starting city', () => {
    const result = runDay({ buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER })

    expect(result.totals.brownoutHours).toBeGreaterThanOrEqual(1)
    expect(result.totals.brownoutHours).toBeLessThanOrEqual(3)

    const eveningBrownouts = result.hourly.filter(h => h.t >= 16 && h.t <= 21 && h.shedBuildingIds.length > 0)
    expect(eveningBrownouts.length).toBeGreaterThan(0)
  })

  it('sheds houses first — grocery stays lit during brownout hours', () => {
    const result = runDay({ buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER })

    const shedHours = result.hourly.filter(h => h.shedBuildingIds.length > 0)
    expect(shedHours.length).toBeGreaterThan(0)

    for (const h of shedHours) {
      // Grocery (id 6) must not be shed while any house (ids 1–5) is present
      const housesShed = h.shedBuildingIds.some(id => id >= 1 && id <= 5)
      if (housesShed) {
        expect(h.shedBuildingIds).not.toContain(6)  // grocery stays lit
      }
    }
  })

  it('perBuildingHoursLost counts shed buildings, not grid × brownoutHours', () => {
    const result = runDay({ buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER })
    const { brownoutHours, perBuildingHoursLost } = result.totals

    // If shortfall is small, only 1 house may shed per hour — not all 7 buildings
    expect(perBuildingHoursLost).toBeGreaterThan(0)
    expect(perBuildingHoursLost).toBeLessThan(brownoutHours * ANCHOR_BUILDINGS.length)
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
      ],
      solarUnits: [1, 1, 1, 1, 1],
      weather: expectedWeather({ temperature: 72, cloudCover: 0, season: 'summer', modernization: 30 }),
    }
    const without = runDay({ ...base, batteries: [] })
    const withBat = runDay({ ...base, batteries: [{ capacity: 2, powerRate: 0.5 }] })
    expect(withBat.totals.curtailment).toBeLessThan(without.totals.curtailment)
  })

  it('battery round-trip efficiency: deliver ≈ stored × 0.90', () => {
    // Single battery, tiny demand so it fully charges from solar then fully discharges overnight
    // Use high solar + low night utility so battery must carry overnight
    const result = runDay({
      buildings: [{ id: 1, type: 'house' }],
      solarUnits: [3],
      batteries: [{ capacity: 4, powerRate: 4 }],
      weather: expectedWeather({ temperature: 72, cloudCover: 0, season: 'summer', modernization: 30 }),
    })
    const totalCharged    = result.hourly.reduce((s, h) => s + h.batteryCharge,    0)
    const totalDischarged = result.hourly.reduce((s, h) => s + h.batteryDischarge, 0)

    // Discharged should be ≤ charged × eff (efficiency loss on discharge)
    if (totalCharged > 0.1) {
      expect(totalDischarged).toBeLessThanOrEqual(totalCharged * ROUND_TRIP_EFF + 0.01)
    }
  })
})

describe('carbon decoupling', () => {
  it('zero peaker energy on a well-supplied grid still has non-zero baseload energy', () => {
    // modernization=100 → ample supply, no brownouts/peaker needed
    const result = runDay({
      buildings: ANCHOR_BUILDINGS,
      weather: expectedWeather({ temperature: 72, cloudCover: 0, season: 'summer', modernization: 100 }),
    })
    // Peaker should not fire; baseload still serves the city all day → emits carbon
    expect(result.totals.energyBySource.peaker).toBeLessThan(0.01)
    expect(result.totals.energyBySource.baseload).toBeGreaterThan(5)
  })
})

describe('reserve margin', () => {
  it('reserve margin is negative when brownouts occur', () => {
    const result = runDay({ buildings: ANCHOR_BUILDINGS, weather: ANCHOR_WEATHER })
    // Peak demand 2.22 > available capacity 2.1 → negative reserve
    expect(result.totals.reserveMargin).toBeLessThan(0)
  })

  it('reserve margin improves when modernization increases supply', () => {
    const low  = runDay({ buildings: ANCHOR_BUILDINGS, weather: expectedWeather({ temperature: 80, modernization: 30  }) })
    const high = runDay({ buildings: ANCHOR_BUILDINGS, weather: expectedWeather({ temperature: 80, modernization: 100 }) })
    expect(high.totals.reserveMargin).toBeGreaterThan(low.totals.reserveMargin)
  })
})
