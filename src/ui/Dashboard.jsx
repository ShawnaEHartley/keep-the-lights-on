// The detail view. The estimate strip above the grid speaks plain language;
// this panel uses the real industry terms and defines each one, so a curious
// player can pick up the vocabulary without being taught it up front.
//
// This is also where a future knowledge-level setting (novice / mid /
// DER-pilled) would swap terminology — see keep-the-lights-on-tooltip-copy-tiers.md.

import { hourLabel, timesLabel } from './EstimatePanel.jsx'
import { carbonBand, carbonMultiple } from '../engine/constants.js'

const GOOD = '#3D7A5C', WARN = '#C4892A', BAD = '#B5421A', MUTED = '#9A8A76'

const STATUS = (value, [good, warn]) =>
  value <= good ? GOOD : value <= warn ? WARN : BAD

function round2(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : v
}

function MetricRow({ term, plain, value, unit, color, definition, delta, deltaFlip }) {
  const d = typeof delta === 'number' ? round2(delta) : null
  const worse = d === null ? false : (deltaFlip ? d < 0 : d > 0)
  return (
    <div style={{ marginBottom: '1.15rem', paddingBottom: '1.15rem', borderBottom: '1px solid #E0D9CE' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: '0.66rem', letterSpacing: '0.09em', textTransform: 'uppercase', color: '#7A6A56', fontFamily: 'monospace' }}>
          {term}
        </span>
        {plain && (
          <span style={{ fontSize: '0.62rem', color: '#B0A090' }}>
            · {plain}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', paddingLeft: '1rem', marginTop: '0.25rem' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '1.45rem', fontWeight: 600, color: '#1B2327', lineHeight: 1 }}>
          {round2(value)}
        </span>
        {unit && <span style={{ fontSize: '0.7rem', color: MUTED, lineHeight: 1.35 }}>{unit}</span>}
        {d !== null && d !== 0 && (
          <span style={{ fontSize: '0.63rem', fontFamily: 'monospace', color: worse ? BAD : GOOD, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {d > 0 ? '+' : ''}{d} vs estimate
          </span>
        )}
      </div>

      <div style={{ paddingLeft: '1rem', fontSize: '0.68rem', color: '#8A7A66', marginTop: '0.35rem', lineHeight: 1.5 }}>
        {definition}
      </div>
    </div>
  )
}

export default function Dashboard({ metrics, vsEstimate = null, isActual = false }) {
  if (!metrics) return null
  const {
    reliability, peakerHours, peakerEnergy, peakerPeakUtilization,
    carbon, cost, reserveMargin, peakHour,
  } = metrics

  const busiest = hourLabel(peakHour ?? 18)
  const reserveColor = reserveMargin >= 15 ? GOOD : reserveMargin >= 0 ? WARN : BAD

  return (
    <div style={{
      marginTop: '1.25rem',
      background: '#F2EEE7',
      borderRadius: 10,
      border: '1px solid #D8D0C4',
      padding: '1.1rem 1.3rem 0.5rem',
    }}>
      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A6A56', fontFamily: 'monospace' }}>
          The details {isActual ? '— actual day' : '— estimate'}
        </div>
        <div style={{ fontSize: '0.66rem', color: '#9A8A76', marginTop: 3, lineHeight: 1.5 }}>
          The same numbers as above, in the words the industry actually uses — each one explained.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '0 2.2rem', maxWidth: 1180 }}>
        <MetricRow
          term="Peaker runtime"
          plain="hours on gas"
          value={peakerHours}
          unit={`hrs · ${peakerPeakUtilization}% of gas capacity at its busiest`}
          color={STATUS(peakerHours, [0, 3])}
          delta={vsEstimate?.peakerHours}
          definition="A peaker is a gas plant that only runs when everything cheaper is already used up. Every hour it runs is fuel burned and carbon in the air — it is the most expensive, dirtiest power on the grid."
        />

        <MetricRow
          term="Reserve margin"
          plain="spare power at peak"
          value={reserveMargin}
          unit={`% spare at ${busiest}`}
          color={reserveColor}
          delta={vsEstimate?.reserveMargin}
          deltaFlip
          definition={`How much more the city could have handled at ${busiest}, its busiest hour, before the lights would go out. Planners size the grid for the worst hour of the year and keep a cushion on top — commonly around 15% — because a hot evening or a plant tripping offline can eat it fast.`}
        />

        <MetricRow
          term="Load shed"
          plain="blackout hours"
          value={reliability.brownoutHours}
          unit={reliability.brownoutHours > 0 ? `hrs · ${reliability.perBuildingHoursLost} circuit-hrs dark` : 'hrs'}
          color={STATUS(reliability.brownoutHours, [0, 1])}
          delta={vsEstimate?.brownoutHours}
          definition="When demand beats every available supply, the grid switches off whole circuits in a pre-set order rather than letting the whole system fail. Utilities call this load shedding. In the US it is rare — the gas plant above is what usually absorbs a peak instead."
        />

        <MetricRow
          term="Emissions"
          plain="CO₂ today"
          value={carbon.total}
          unit={`kg · ${timesLabel(carbonMultiple(carbon.total, carbon.benchmark))} a clean grid, which would emit ${carbon.benchmark}`}
          color={{ good: GOOD, warn: WARN, bad: BAD }[carbonBand(carbon.total, carbon.benchmark)]}
          delta={vsEstimate?.carbon}
          definition="Total carbon put in the air today. It depends on which plants ran, not just how much power you used — each source has its own carbon intensity, the amount per unit of energy. Your everyday grid power carries carbon too, so this can stay high even on a day the gas peaker never starts."
        />

        <MetricRow
          term="Cost to serve"
          plain="what the day cost"
          value={`$${cost}`}
          unit="today"
          color={STATUS(cost, [20, 40])}
          definition="What it cost to generate the day's power. Most households pay a flat rate, so this is not your bill — but everyone's bill pays for the plants and wires built to survive the peak hour."
        />

        <MetricRow
          term="Gas burned"
          plain="fuel used"
          value={peakerEnergy}
          unit="energy units"
          color={STATUS(peakerEnergy, [0, 1])}
          delta={vsEstimate?.peakerEnergy}
          definition="Energy units are this game's own measure, not kilowatt-hours — sized so that one meaningful change moves the number visibly."
        />
      </div>
    </div>
  )
}
