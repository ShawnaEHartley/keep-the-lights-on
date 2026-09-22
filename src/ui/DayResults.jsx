// Full-width end-of-day summary panel — shown below the grid after Run Day completes

import { hourLabel } from './EstimatePanel.jsx'

const BUILDING_LABELS = {
  house:     'House',
  wfh_house: 'WFH Home',
  office:    'Office',
  grocery:   'Grocery',
}

const DELTA_COLOR = d => d < 0 ? '#3D7A5C' : d > 0 ? '#B5421A' : '#9A8A76'
const DELTA_LABEL = d => d === 0 ? 'as expected' : d > 0 ? `+${fmt(d)} (worse)` : `${fmt(d)} (better)`

// Round to at most 2 decimals and drop trailing zeros. Subtracting two
// one-decimal numbers in binary floating point gives things like
// 0.20000000000000007, which must never reach the screen.
function round2(v) { return Math.round(v * 100) / 100 }
function fmt(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return v
  return String(round2(v))
}

// Group building IDs by type, ordered by type then ID
function labelBuilding(id, buildings) {
  const b = buildings.find(x => x.id === id)
  if (!b) return `Building ${id}`
  const sameType = buildings.filter(x => x.type === b.type).sort((a, z) => a.id - z.id)
  const nth = sameType.findIndex(x => x.id === id) + 1
  return `${BUILDING_LABELS[b.type] ?? b.type} ${nth}`
}

// Convert a list of hours into human-readable ranges like "17:00–18:00"
function hoursToRanges(hours) {
  if (!hours.length) return ''
  const sorted = [...hours].sort((a, b) => a - b)
  const ranges = []
  let start = sorted[0], prev = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; continue }
    ranges.push([start, prev])
    start = sorted[i]; prev = sorted[i]
  }
  ranges.push([start, prev])
  return ranges.map(([s, e]) =>
    s === e ? `${String(s).padStart(2,'0')}:00` : `${String(s).padStart(2,'0')}:00–${String(e+1).padStart(2,'0')}:00`
  ).join(', ')
}

function aggregateShedding(hourly, buildings) {
  const shedMap = {}
  for (const h of hourly) {
    for (const id of (h.shedBuildingIds ?? [])) {
      if (!shedMap[id]) shedMap[id] = []
      shedMap[id].push(h.t)
    }
  }
  return Object.entries(shedMap)
    .map(([id, hours]) => ({ id: Number(id), label: labelBuilding(Number(id), buildings), hours }))
    .sort((a, b) => a.id - b.id)
}

function CompareRow({ label, estimate, actual, unit = '', flip = false }) {
  const raw  = (typeof actual === 'number' && typeof estimate === 'number') ? actual - estimate : null
  const diff = raw === null ? null : round2(raw)
  const color = diff === null ? '#9A8A76' : DELTA_COLOR(flip ? -diff : diff)
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.75rem' }}>
      <span style={{ fontSize: '0.65rem', color: '#9A8A76', fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 110 }}>
        {label}
      </span>
      <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#B0A090' }}>
        {fmt(estimate)}{unit}
      </span>
      <span style={{ fontSize: '0.75rem', color: '#B0A090' }}>→</span>
      <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 600, color: '#1B2327' }}>
        {fmt(actual)}{unit}
      </span>
      {diff !== null && diff !== 0 && (
        <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color }}>
          {DELTA_LABEL(diff)}
        </span>
      )}
      {diff === 0 && (
        <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#9A8A76' }}>as expected</span>
      )}
    </div>
  )
}

export default function DayResults({ actualResult, estimateResult, actualMetrics, estimateMetrics, city, weather }) {
  if (!actualResult || !actualMetrics) return null

  const shed = aggregateShedding(actualResult.hourly, city.buildings)
  const hasShedding = shed.length > 0
  const peakerRuns = actualResult.hourly.filter(h => h.peaker > 0.001).map(h => h.t)

  const tempDiff = weather ? Math.round(weather.temperature - city.levers.temperature) : 0
  const weatherNote = (() => {
    const parts = []
    if (tempDiff > 0) parts.push(`${tempDiff}°F warmer than expected`)
    if (tempDiff < 0) parts.push(`${Math.abs(tempDiff)}°F cooler than expected`)
    if (weather?.contingencyFactor < 0.95) parts.push(`grid capacity reduced ${Math.round((1 - weather.contingencyFactor) * 100)}% by contingency`)
    return parts.length ? parts.join(', ') : 'day matched expectations closely'
  })()

  return (
    <div style={{
      marginTop: '1.5rem',
      background: '#EFEBE3',
      borderRadius: 10,
      border: '1px solid #D8D0C4',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '0.75rem 1.4rem',
        borderBottom: '1px solid #D8D0C4',
        background: '#E8E2D9',
        display: 'flex', alignItems: 'center', gap: '1rem',
      }}>
        <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A6A56', fontFamily: 'monospace' }}>
          Day Results
        </span>
        <span style={{ fontSize: '0.65rem', color: '#9A8A76', fontFamily: 'monospace' }}>
          {weatherNote}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
        {/* Left: estimate vs actual comparison */}
        <div style={{ flex: '1 1 260px', padding: '1.2rem 1.4rem', borderRight: '1px solid #D8D0C4' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B0A090', marginBottom: '1rem', fontFamily: 'monospace' }}>
            Estimate → Actual
          </div>
          <CompareRow
            label="Gas plant ran"
            estimate={estimateMetrics.peakerHours}
            actual={actualMetrics.peakerHours}
            unit=" hrs"
          />
          <CompareRow
            label="Gas burned"
            estimate={estimateMetrics.peakerEnergy}
            actual={actualMetrics.peakerEnergy}
            unit=" energy units"
          />
          <CompareRow
            label="Blackout hrs"
            estimate={estimateMetrics.reliability.brownoutHours}
            actual={actualMetrics.reliability.brownoutHours}
          />
          <CompareRow
            label="CO₂"
            estimate={estimateMetrics.carbon.total}
            actual={actualMetrics.carbon.total}
            unit=" kg"
          />
          <CompareRow
            label="Spare power at peak"
            estimate={estimateMetrics.reserveMargin}
            actual={actualMetrics.reserveMargin}
            unit="%"
            flip
          />
          <div style={{ borderTop: '1px solid #D8D0C4', marginTop: '0.6rem', paddingTop: '0.6rem', fontSize: '0.62rem', color: '#B0A090', fontFamily: 'monospace', lineHeight: 1.6 }}>
            spare power = how much more the city could have taken at {hourLabel(actualMetrics.peakHour ?? 18)}, its busiest hour
            <br />CO₂ good ≤ {actualMetrics.carbon.benchmark} kg · cost ${actualMetrics.cost}
          </div>
        </div>

        {/* Right: which buildings lost power */}
        <div style={{ flex: '1 1 260px', padding: '1.2rem 1.4rem' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B0A090', marginBottom: '1rem', fontFamily: 'monospace' }}>
            {hasShedding ? 'Buildings that lost power' : 'What it cost to stay lit'}
          </div>

          {!hasShedding && (
            <div>
              <div style={{ fontSize: '0.82rem', color: '#3D7A5C', fontFamily: 'monospace', marginBottom: '0.7rem' }}>
                Everyone kept their power all day.
              </div>
              {peakerRuns.length > 0 ? (
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.9rem', lineHeight: 1.2, marginTop: 1 }}>🔥</span>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#B5421A', fontWeight: 600 }}>
                      The gas plant did it
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#8A4A34', fontFamily: 'monospace', marginTop: 2, lineHeight: 1.5 }}>
                      burning {hoursToRanges(peakerRuns)} · {peakerRuns.length} hr{peakerRuns.length !== 1 ? 's' : ''} · {actualMetrics.peakerEnergy} energy units of gas
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: '#3D7A5C', fontFamily: 'monospace', lineHeight: 1.5 }}>
                  …and the gas plant never had to start. This is the clean day.
                </div>
              )}
            </div>
          )}

          {shed.map(({ id, label, hours }) => (
            <div key={id} style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.85rem', lineHeight: 1.2, marginTop: 1 }}>⌂</span>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#1B2327', fontWeight: 600 }}>
                  {label}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#B5421A', fontFamily: 'monospace', marginTop: 1 }}>
                  no power {hoursToRanges(hours)} · {hours.length} hr{hours.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))}

          {hasShedding && (
            <div style={{ borderTop: '1px solid #D8D0C4', marginTop: '0.6rem', paddingTop: '0.7rem', fontSize: '0.67rem', color: '#9A8A76', lineHeight: 1.6 }}>
              Houses lose power first — the grid protects critical loads like refrigeration.
              Adding a battery or solar can shift this.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
