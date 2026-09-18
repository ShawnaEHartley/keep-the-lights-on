const PERIOD = [
  'Night','Night','Night','Night','Night','Night',
  'Morning','Morning','Morning',
  'Midday','Midday','Midday',
  'Afternoon','Afternoon','Afternoon','Afternoon',
  'Evening peak','Evening peak','Evening peak','Evening peak','Evening peak',
  'Late night','Late night','Late night',
]
const PERIOD_COLOR = {
  'Night':'#6A7FA8','Morning':'#C4892A','Midday':'#3D7A5C',
  'Afternoon':'#C4892A','Evening peak':'#B5421A','Late night':'#6A7FA8',
}

const btn = (extra = {}) => ({
  padding: '0.35rem 0.8rem',
  border: '1.5px solid #C8C0B4',
  borderRadius: 5,
  background: '#F5F1EA',
  color: '#1B2327',
  fontFamily: 'monospace',
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  cursor: 'pointer',
  ...extra,
})

// 24h sparkline: demand vs supply, cloud cover background, brownout zones, hour cursor
function DayChart({ hourly, estimateHourly, cloudByHour, supplyCapacity, currentHour, dayComplete }) {
  const VW = 600
  const VH = 58

  const chartData    = hourly ?? estimateHourly
  const isActual     = !!hourly
  if (!chartData) return null

  const allDemands = chartData.map(h => h.demand)
  const maxD       = Math.max(...allDemands, supplyCapacity * 1.05, 0.1)

  const tx = t => (t / 23) * VW
  const ty = v => VH - (v / maxD) * VH

  const demandPts = chartData.map(h => `${tx(h.t).toFixed(1)},${ty(h.demand).toFixed(1)}`).join(' ')
  const estPts    = estimateHourly && isActual
    ? estimateHourly.map(h => `${tx(h.t).toFixed(1)},${ty(h.demand).toFixed(1)}`).join(' ')
    : null

  const supplyY = ty(supplyCapacity)

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%" height={VH}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      {/* Cloud cover: per-hour grey fill — darker = more cloud */}
      {cloudByHour?.map((cloud, t) => (
        <rect key={`c${t}`}
          x={tx(t)} y={0}
          width={VW / 24} height={VH}
          fill="#3A4A5A" opacity={cloud * 0.28}
        />
      ))}

      {/* Brownout / shed zones — revealed after day is complete */}
      {dayComplete && chartData.map(h => h.shedBuildingIds?.length > 0 && (
        <rect key={`b${h.t}`}
          x={tx(h.t)} y={0}
          width={VW / 24} height={VH}
          fill="#B5421A" opacity={0.18}
        />
      ))}

      {/* Supply cap line */}
      <line
        x1={0} y1={supplyY} x2={VW} y2={supplyY}
        stroke="#4A7EB5" strokeWidth={1.2} strokeDasharray="6,3" opacity={0.85}
      />
      <text x={VW - 2} y={supplyY - 3} textAnchor="end"
        fontSize={7} fill="#4A7EB5" fontFamily="monospace" opacity={0.85}>
        grid cap
      </text>

      {/* Estimate demand curve (lighter, shown under actual when both available) */}
      {estPts && (
        <polyline points={estPts}
          fill="none" stroke="#C4892A" strokeWidth={1} opacity={0.35} strokeDasharray="4,2" />
      )}

      {/* Demand curve */}
      <polyline points={demandPts}
        fill="none"
        stroke="#C4892A"
        strokeWidth={isActual ? 1.8 : 1.2}
        opacity={isActual ? 0.95 : 0.5}
      />

      {/* Zero baseline */}
      <line x1={0} y1={VH} x2={VW} y2={VH} stroke="#D8D0C4" strokeWidth={0.5} />

      {/* Hour ticks: 6, 12, 18 */}
      {[6, 12, 18].map(t => (
        <line key={t} x1={tx(t)} y1={VH - 4} x2={tx(t)} y2={VH}
          stroke="#B0A090" strokeWidth={0.8} />
      ))}

      {/* Current hour cursor */}
      {isActual && (
        <line
          x1={tx(currentHour)} y1={0}
          x2={tx(currentHour)} y2={VH}
          stroke="#1B2327" strokeWidth={1.2} opacity={0.5}
        />
      )}
    </svg>
  )
}

export default function DayClock({
  hour, playing, started, dayComplete,
  hourly, estimateHourly, cloudByHour, supplyCapacity,
  temperature, actualTemperature,
  onRun, onPause, onResume, onReset,
}) {
  const hh       = String(hour).padStart(2, '0')
  const period   = PERIOD[hour]
  const color    = PERIOD_COLOR[period]
  const isBrownout = started && hourly ? (hourly[hour]?.shedBuildingIds?.length ?? 0) > 0 : false

  const brownoutHours = (dayComplete && hourly)
    ? hourly.filter(h => h.shedBuildingIds?.length > 0).map(h => h.t)
    : []

  const tempDiff = (actualTemperature != null && actualTemperature !== temperature)
    ? actualTemperature - temperature
    : null

  return (
    <div style={{
      borderBottom: '1px solid #D8D0C4',
      background: '#EFEBE3',
    }}>
      {/* Top row: time + controls + weather callout */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.4rem',
        padding: '0.6rem 2rem 0.4rem',
        flexWrap: 'wrap',
      }}>
        {/* Time */}
        <div style={{ minWidth: 110 }}>
          <span style={{
            fontFamily: 'monospace', fontSize: '1.8rem', fontWeight: 700,
            color: isBrownout ? '#B5421A' : '#1B2327', lineHeight: 1,
          }}>
            {hh}:00
          </span>
          <span style={{
            display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', fontFamily: 'monospace', marginTop: 2,
            color: isBrownout ? '#B5421A' : color,
          }}>
            {isBrownout ? 'Brownout' : period}
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {!started ? (
            <button style={btn({ background: '#16877A', color: '#fff', border: '1.5px solid #0F6558' })} onClick={onRun}>
              ▶ Run Day
            </button>
          ) : playing ? (
            <button style={btn()} onClick={onPause}>⏸ Pause</button>
          ) : (
            <button style={btn()} onClick={onResume}>▶ Resume</button>
          )}
          {started && <button style={btn({ color: '#9A8A76' })} onClick={onReset}>↺ Reset</button>}
        </div>

        {/* Weather callout */}
        <div style={{ display: 'flex', gap: '1.2rem', marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#7A6A56' }}>
            {started && actualTemperature != null
              ? <>
                  {Math.round(actualTemperature)}°F actual
                  {tempDiff != null && (
                    <span style={{ color: tempDiff > 0 ? '#B5421A' : '#3D7A5C', marginLeft: 4 }}>
                      ({tempDiff > 0 ? '+' : ''}{Math.round(tempDiff)}° vs expected)
                    </span>
                  )}
                </>
              : <>{temperature}°F expected</>
            }
          </span>
          {/* Legend chips */}
          <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: 14, height: 2.5, background: '#C4892A', borderRadius: 2, display: 'inline-block' }} />
              <span style={{ fontSize: '0.6rem', color: '#9A8A76', fontFamily: 'monospace' }}>demand</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: 14, height: 1.5, background: '#4A7EB5', borderRadius: 2, display: 'inline-block' }} />
              <span style={{ fontSize: '0.6rem', color: '#9A8A76', fontFamily: 'monospace' }}>grid cap</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: 10, height: 10, background: '#3A4A5A', borderRadius: 1, opacity: 0.4, display: 'inline-block' }} />
              <span style={{ fontSize: '0.6rem', color: '#9A8A76', fontFamily: 'monospace' }}>cloud</span>
            </span>
            {brownoutHours.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: 10, height: 10, background: '#B5421A', borderRadius: 1, opacity: 0.4, display: 'inline-block' }} />
                <span style={{ fontSize: '0.6rem', color: '#B5421A', fontFamily: 'monospace' }}>brownout</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sparkline chart — full width */}
      <div style={{ padding: '0 2rem 0.1rem', position: 'relative' }}>
        <DayChart
          hourly={hourly}
          estimateHourly={estimateHourly}
          cloudByHour={cloudByHour}
          supplyCapacity={supplyCapacity ?? 2.0}
          currentHour={hour}
          dayComplete={dayComplete}
        />
        {/* Hour labels below chart */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '0.55rem', color: '#B0A090', fontFamily: 'monospace',
          padding: '0.1rem 0 0.3rem',
        }}>
          {['00:00','03:00','06:00','09:00','12:00','15:00','18:00','21:00','23:00'].map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
