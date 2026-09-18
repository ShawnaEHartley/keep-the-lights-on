import { baseloadCarbon, PEAKER_CARBON, BENCHMARK_CARBON, UTILITY_COST, PEAKER_COST } from './constants.js'

/**
 * computeMetrics(actualResult, estimateResult?, prevDayResult?, renewableMix?)
 * Returns the dashboard metrics for the actual day with estimate deltas and ghost baseline.
 * spec §3.6, §3.8, §3.9
 */
export function computeMetrics(actualResult, estimateResult = null, prevDayResult = null, renewableMix = 30) {
  const { totals } = actualResult
  const { energyBySource, peakerEnergy, brownoutHours, perBuildingHoursLost, curtailment, reserveMargin } = totals

  const baseloadInt = baseloadCarbon(renewableMix)

  // Carbon: per source × intensity; shown as total vs benchmark only (spec §3.8)
  const carbonTotal = Math.round(
    (energyBySource.baseload * baseloadInt) +
    (energyBySource.peaker   * PEAKER_CARBON)
    // solar and battery are 0 carbon
  )
  const totalDemand = Object.values(energyBySource).reduce((s, v) => s + v, 0)
  const carbonBenchmark = Math.round(totalDemand * BENCHMARK_CARBON)

  // Cost: per-source tally (readout, not a market signal)
  const cost = Math.round(energyBySource.baseload * UTILITY_COST + energyBySource.peaker * PEAKER_COST)

  const metrics = {
    reliability: {
      brownoutHours,
      perBuildingHoursLost,
    },
    peakerEnergy: roundOne(peakerEnergy),
    curtailment:  roundOne(curtailment),
    carbon: {
      total:     carbonTotal,
      benchmark: carbonBenchmark,
    },
    cost,
    reserveMargin: Math.round(reserveMargin * 100),  // as a percent
    vsEstimate:  null,
    deltas:      null,
  }

  // Estimate delta (actual − estimate)
  if (estimateResult) {
    const est = estimateResult.totals
    const estBaseloadInt = baseloadCarbon(renewableMix)
    const estCarbon = Math.round(
      (est.energyBySource.baseload * estBaseloadInt) +
      (est.energyBySource.peaker   * PEAKER_CARBON)
    )
    metrics.vsEstimate = {
      brownoutHours: brownoutHours - est.brownoutHours,
      peakerEnergy:  roundOne(peakerEnergy - est.peakerEnergy),
      carbon:        carbonTotal   - estCarbon,
    }
  }

  // Ghost baseline (vs yesterday)
  if (prevDayResult) {
    const prev = computeMetrics(prevDayResult, null, null, renewableMix)
    metrics.deltas = {
      brownoutHours: metrics.reliability.brownoutHours - prev.reliability.brownoutHours,
      peakerEnergy:  metrics.peakerEnergy  - prev.peakerEnergy,
      cost:          metrics.cost          - prev.cost,
      carbon:        metrics.carbon.total  - prev.carbon.total,
    }
  }

  return metrics
}

function roundOne(v) { return Math.round(v * 10) / 10 }
