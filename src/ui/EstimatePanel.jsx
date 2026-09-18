// Horizontal estimate strip — sits below the grid in build mode (spec §2, §3.7)

const STATUS = (v, [good, warn]) =>
  v <= good ? '#3D7A5C' : v <= warn ? '#C4892A' : '#B5421A'

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

export default function EstimatePanel({ estimateMetrics }) {
  if (!estimateMetrics) return null
  const { reliability, peakerEnergy, carbon, reserveMargin } = estimateMetrics

  const reserveColor = reserveMargin >= 10 ? '#3D7A5C' : reserveMargin >= 0 ? '#C4892A' : '#B5421A'
  const reserveSub   = reserveMargin >= 10 ? 'healthy headroom' : reserveMargin >= 0 ? 'tight — add margin' : 'will brown out'

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
        <EstCol
          label="Brownout hrs"
          value={reliability.brownoutHours}
          unit={reliability.brownoutHours > 0 ? `~${reliability.perBuildingHoursLost} building-hrs lost` : 'all served'}
          color={STATUS(reliability.brownoutHours, [0, 2])}
        />
        <EstCol
          label="Peaker gas"
          value={peakerEnergy}
          unit="energy units"
          color={STATUS(peakerEnergy, [0, 1])}
        />
        <EstCol
          label="CO₂"
          value={carbon.total}
          unit={`kg · good ≤ ${carbon.benchmark}`}
          color={STATUS(carbon.total, [carbon.benchmark * 1.5, carbon.benchmark * 3])}
        />
        <EstCol
          label="Reserve margin"
          value={`${reserveMargin > 0 ? '+' : ''}${reserveMargin}%`}
          unit={reserveSub}
          color={reserveColor}
          style={{ borderRight: 'none' }}
        />
      </div>
    </div>
  )
}
