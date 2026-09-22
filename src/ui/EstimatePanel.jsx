// Horizontal estimate strip — sits below the grid in build mode (spec §2, §3.7)
// The peaker is the headline: in the US the everyday cost of a tight grid is
// gas and emissions, not outages, so the gas plant is what the panel shouts about.

const STATUS = (v, [good, warn]) =>
  v <= good ? '#3D7A5C' : v <= warn ? '#C4892A' : '#B5421A'

// 18 -> "6pm". The busiest hour needs a name a person recognises.
export function hourLabel(h) {
  const hr = ((h % 24) + 24) % 24
  if (hr === 0) return 'midnight'
  if (hr === 12) return 'noon'
  return hr < 12 ? `${hr}am` : `${hr - 12}pm`
}

function EstCol({ label, value, unit, color, sub }) {
  return (
    <div style={{ flex: '1 1 120px', padding: '0.85rem 1.1rem', borderRight: '1px solid #D8D0C4' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: '0.6rem', letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9A8A76', fontFamily: 'monospace' }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, color: '#1B2327', lineHeight: 1 }}>
        {value}
      </div>
      {unit && (
        <div style={{ fontSize: '0.6rem', color: '#B0A090', marginTop: 2 }}>{unit}</div>
      )}
      {sub && (
        <div style={{ fontSize: '0.6rem', color: '#9A8A76', marginTop: 4, lineHeight: 1.4 }}>{sub}</div>
      )}
    </div>
  )
}

// The villain cell. Loud when the gas plant has to run, quiet green when it doesn't.
export function PeakerCell({ hours, energy, utilization = 0, wide = false }) {
  const firing = hours > 0
  return (
    <div style={{
      flex: wide ? '1.4 1 200px' : '1 1 150px',
      padding: '0.85rem 1.1rem',
      borderRight: '1px solid #D8D0C4',
      background: firing ? '#F3DED4' : 'transparent',
      borderLeft: firing ? '3px solid #B5421A' : '3px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.72rem', lineHeight: 1 }}>{firing ? '🔥' : '○'}</span>
        <span style={{
          fontSize: '0.6rem', letterSpacing: '0.09em', textTransform: 'uppercase',
          color: firing ? '#B5421A' : '#9A8A76', fontFamily: 'monospace',
          fontWeight: firing ? 700 : 400,
        }}>
          {firing ? 'Gas peaker runs' : 'Gas peaker'}
        </span>
      </div>
      <div style={{
        fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1,
        color: firing ? '#B5421A' : '#3D7A5C',
      }}>
        {firing ? `${hours} hr${hours !== 1 ? 's' : ''}` : 'never'}
      </div>
      <div style={{ fontSize: '0.6rem', color: firing ? '#8A4A34' : '#B0A090', marginTop: 3, lineHeight: 1.4 }}>
        {firing
          ? `at its worst, ${utilization}% of your gas capacity was running — the dirtiest power on the grid`
          : 'the city never needs the dirty backup'}
      </div>
    </div>
  )
}

export default function EstimatePanel({ estimateMetrics }) {
  if (!estimateMetrics) return null
  const { reliability, peakerEnergy, peakerHours, peakerPeakUtilization, carbon, reserveMargin, peakHour } = estimateMetrics

  const spareColor = reserveMargin >= 10 ? '#3D7A5C' : reserveMargin >= 0 ? '#C4892A' : '#B5421A'
  const busiest    = hourLabel(peakHour ?? 18)
  const spareSub   = reserveMargin < 0
    ? `busiest at ${busiest} — ${Math.abs(reserveMargin)}% short, the lights go out`
    : `busiest at ${busiest} — room for ${reserveMargin}% more before the lights go out`

  return (
    <div style={{
      marginTop: '1.25rem',
      background: '#EFEBE3',
      borderRadius: 10,
      border: '1.5px dashed #C8C0B4',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '0.45rem 1.1rem',
        borderBottom: '1px solid #D8D0C4',
        background: '#E8E2D9',
        display: 'flex', alignItems: 'center', gap: '1rem',
      }}>
        <span style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A8A76', fontFamily: 'monospace' }}>
          Estimate — typical day
        </span>
        <span style={{ fontSize: '0.6rem', color: '#B0A090', fontFamily: 'monospace' }}>
          press Run Day to see the actual reveal
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <PeakerCell hours={peakerHours} energy={peakerEnergy} utilization={peakerPeakUtilization} wide />
        <EstCol
          label="CO₂"
          value={carbon.total}
          unit={`kg · good ≤ ${carbon.benchmark}`}
          color={STATUS(carbon.total, [carbon.benchmark * 1.5, carbon.benchmark * 3])}
        />
        <EstCol
          label="Spare power at peak"
          value={`${reserveMargin > 0 ? '+' : ''}${reserveMargin}%`}
          unit={spareSub}
          color={spareColor}
        />
        <EstCol
          label="Blackout hrs"
          value={reliability.brownoutHours}
          unit={reliability.brownoutHours > 0
            ? `~${reliability.perBuildingHoursLost} building-hrs lost`
            : 'everyone stays powered'}
          color={STATUS(reliability.brownoutHours, [0, 2])}
        />
      </div>
    </div>
  )
}
