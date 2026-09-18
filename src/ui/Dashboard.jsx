const STATUS = (value, thresholds) => {
  if (value <= thresholds[0]) return '#3D7A5C'
  if (value <= thresholds[1]) return '#C4892A'
  return '#B5421A'
}

const DELTA_SIGN = d => d === null || d === undefined ? '' : d > 0 ? `+${d}` : `${d}`

function MetricRow({ label, value, unit, color, sub, delta }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.15rem' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0, marginBottom: 2 }} />
        <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A6A56' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', paddingLeft: '1rem' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '1.7rem', fontWeight: 600, color: '#1B2327', lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: '0.72rem', color: '#9A8A76' }}>{unit}</span>
        {delta != null && (
          <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: delta < 0 ? '#3D7A5C' : delta > 0 ? '#B5421A' : '#9A8A76', marginLeft: 'auto' }}>
            est {DELTA_SIGN(delta)}
          </span>
        )}
      </div>
      {sub && <div style={{ paddingLeft: '1rem', fontSize: '0.7rem', color: '#9A8A76', marginTop: '0.1rem' }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard({ metrics }) {
  if (!metrics) return null
  const { reliability, peakerEnergy, carbon, cost, reserveMargin, vsEstimate } = metrics

  const reserveColor = reserveMargin >= 10 ? '#3D7A5C' : reserveMargin >= 0 ? '#C4892A' : '#B5421A'

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: '#EFEBE3',
      borderRadius: 10,
      padding: '1.4rem 1.2rem',
      border: '1px solid #D8D0C4',
    }}>
      <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A8A76', marginBottom: '0.25rem' }}>
        Actual Day
      </div>
      {vsEstimate && (
        <div style={{ fontSize: '0.62rem', color: '#B0A090', marginBottom: '1.4rem', fontFamily: 'monospace' }}>
          vs estimate shown in row
        </div>
      )}

      <MetricRow
        label="Reliability"
        value={reliability.brownoutHours}
        unit="brownout hrs"
        color={STATUS(reliability.brownoutHours, [0, 2])}
        sub={reliability.brownoutHours > 0
          ? `${reliability.perBuildingHoursLost} building-hrs lost`
          : 'All buildings served'}
        delta={vsEstimate?.brownoutHours}
      />
      <MetricRow
        label="Peaker gas"
        value={peakerEnergy}
        unit="EU"
        color={STATUS(peakerEnergy, [0, 1])}
        delta={vsEstimate?.peakerEnergy}
      />
      <MetricRow
        label="CO₂"
        value={carbon.total}
        unit={`kg  (good ≤ ${carbon.benchmark})`}
        color={STATUS(carbon.total, [carbon.benchmark * 1.5, carbon.benchmark * 3])}
        delta={vsEstimate?.carbon}
      />
      <MetricRow
        label="Est. cost"
        value={`$${cost}`}
        unit="today"
        color={STATUS(cost, [20, 40])}
      />
      <MetricRow
        label="Reserve margin"
        value={`${reserveMargin > 0 ? '+' : ''}${reserveMargin}%`}
        unit=""
        color={reserveColor}
      />
    </aside>
  )
}
