// Cost and CO₂ rates — placeholder scale, PM iterates after playtest
const UTILITY_COST  = 0.80  // $/EU
const PEAKER_COST   = 2.00  // $/EU
const UTILITY_CO2   = 0.8   // kg/EU (grid mix)
const PEAKER_CO2    = 2.0   // kg/EU (gas peaker)

export function computeMetrics(dayResult, prevDayResult = null) {
  const { hourly, totals } = dayResult

  const utilityEnergy = hourly.reduce((s, h) => s + h.utility, 0)
  const cost   = Math.round(utilityEnergy * UTILITY_COST + totals.peakerEnergy * PEAKER_COST)
  const carbon = Math.round(utilityEnergy * UTILITY_CO2  + totals.peakerEnergy * PEAKER_CO2)

  const metrics = {
    reliability: {
      brownoutHours:     totals.brownoutHours,
      buildingHoursLost: totals.buildingHoursLost,
    },
    peakerEnergy: Math.round(totals.peakerEnergy * 10) / 10,
    curtailment:  Math.round(totals.curtailment  * 10) / 10,
    cost,
    carbon,
    deltas: null,
  }

  if (prevDayResult) {
    const prev = computeMetrics(prevDayResult)
    metrics.deltas = {
      brownoutHours: metrics.reliability.brownoutHours - prev.reliability.brownoutHours,
      peakerEnergy:  metrics.peakerEnergy  - prev.peakerEnergy,
      cost:          metrics.cost          - prev.cost,
      carbon:        metrics.carbon        - prev.carbon,
    }
  }

  return metrics
}
