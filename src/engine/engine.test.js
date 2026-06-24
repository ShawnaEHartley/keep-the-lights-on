import { describe, it, expect } from 'vitest'
import { runDay } from './dispatch.js'

// ── Calibration anchor (spec §8) ─────────────────────────────────────────────
// Starting city: 5 houses, 1 grocery, 1 office.
// No solar, no batteries. Modernization = 30%. Temperature ≥ 80°F.
// Expected: brownoutHours ≈ 2, falling in the evening block (hours 17–21).

describe('calibration anchor', () => {
  it('produces ~2 brownout hours in the evening with the starting city', () => {
    const result = runDay({
      buildings: [
        { type: 'house' },
        { type: 'house' },
        { type: 'house' },
        { type: 'house' },
        { type: 'house' },
        { type: 'grocery' },
        { type: 'office' },
      ],
      solarUnits: [],
      batteries: [],
      uCap: undefined,   // tuned in dispatch.js
      peakCap: undefined,
      levers: { temperature: 80, cloudCover: 0, modernization: 30 },
    })

    const { brownoutHours } = result.totals
    expect(brownoutHours).toBeGreaterThanOrEqual(1)
    expect(brownoutHours).toBeLessThanOrEqual(3)

    const eveningBrownouts = result.hourly
      .filter(h => h.t >= 17 && h.t <= 21 && h.shortfall > 0)
    expect(eveningBrownouts.length).toBeGreaterThan(0)
  })
})

// ── Sanity tests ──────────────────────────────────────────────────────────────

describe('engine sanity', () => {
  it('adding a battery reduces peaker energy or brownout hours', () => {
    const base = { buildings: [
      { type: 'house' }, { type: 'house' }, { type: 'house' },
      { type: 'house' }, { type: 'house' },
      { type: 'grocery' }, { type: 'office' },
    ], solarUnits: [], levers: { temperature: 80, cloudCover: 0, modernization: 30 } }

    const without = runDay({ ...base, batteries: [] })
    const with1   = runDay({ ...base, batteries: [{ capacity: 1 }] })

    expect(with1.totals.peakerEnergy + with1.totals.brownoutHours)
      .toBeLessThan(without.totals.peakerEnergy + without.totals.brownoutHours)
  })

  it('all-solar roofs with no battery produces midday curtailment', () => {
    const result = runDay({
      buildings: [
        { type: 'house' }, { type: 'house' }, { type: 'house' },
        { type: 'house' }, { type: 'house' },
      ],
      solarUnits: [1, 1, 1, 1, 1],
      batteries: [],
      levers: { temperature: 72, cloudCover: 0, modernization: 30 },
    })
    expect(result.totals.curtailment).toBeGreaterThan(0)
  })

  it('adding a battery to solar eliminates or reduces curtailment', () => {
    const base = {
      buildings: [
        { type: 'house' }, { type: 'house' }, { type: 'house' },
        { type: 'house' }, { type: 'house' },
      ],
      solarUnits: [1, 1, 1, 1, 1],
      levers: { temperature: 72, cloudCover: 0, modernization: 30 },
    }
    const without = runDay({ ...base, batteries: [] })
    const with1   = runDay({ ...base, batteries: [{ capacity: 1 }] })
    expect(with1.totals.curtailment).toBeLessThan(without.totals.curtailment)
  })
})
