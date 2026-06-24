const STATUS = (value, thresholds) => {
  if (value <= thresholds[0]) return '#3D7A5C'  // green
  if (value <= thresholds[1]) return '#C4892A'  // amber
  return '#B5421A'                               // red
}

function MetricRow({ label, value, unit, color, sub }) {
  return (
    <div style={{ marginBottom: '1.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.2rem' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0, marginBottom: 2 }} />
        <span style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A6A56' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', paddingLeft: '1rem' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '1.8rem', fontWeight: 600, color: '#1B2327', lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: '0.75rem', color: '#9A8A76' }}>{unit}</span>
      </div>
      {sub && <div style={{ paddingLeft: '1rem', fontSize: '0.72rem', color: '#9A8A76', marginTop: '0.15rem' }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard({ metrics }) {
  if (!metrics) return null
  const { reliability, peakerEnergy, cost, carbon } = metrics

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: '#EFEBE3',
      borderRadius: 10,
      padding: '1.4rem 1.2rem',
      border: '1px solid #D8D0C4',
    }}>
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A8A76', marginBottom: '1.6rem' }}>
        Day Summary
      </div>

      <MetricRow
        label="Reliability"
        value={reliability.brownoutHours}
        unit="brownout hrs"
        color={STATUS(reliability.brownoutHours, [0, 2])}
        sub={reliability.brownoutHours > 0 ? `${reliability.buildingHoursLost} building-hrs lost` : 'All buildings served'}
      />
      <MetricRow
        label="Peaker gas"
        value={peakerEnergy}
        unit="energy units"
        color={STATUS(peakerEnergy, [0, 1])}
      />
      <MetricRow
        label="Est. cost"
        value={`$${cost}`}
        unit="today"
        color={STATUS(cost, [30, 50])}
      />
      <MetricRow
        label="CO₂"
        value={carbon}
        unit="kg today"
        color={STATUS(carbon, [30, 50])}
      />

      <div style={{ borderTop: '1px solid #D8D0C4', marginTop: '0.4rem', paddingTop: '0.8rem', fontSize: '0.65rem', color: '#B0A090', lineHeight: 1.5 }}>
        Utility cap: 3.1 EU/hr<br />
        Peaker cap: 0.5 EU/hr
      </div>
    </aside>
  )
}
