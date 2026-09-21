import { GRID_COLS, GRID_ROWS, CELL_SIZE, CELL_STEP } from '../state/cityModel.js'

// pixel center of a grid cell (1-indexed col/row)
const cx = col => (col - 1) * CELL_STEP + CELL_SIZE / 2
const cy = row => (row - 1) * CELL_STEP + CELL_SIZE / 2

const SVG_W = GRID_COLS * CELL_STEP - (CELL_STEP - CELL_SIZE)  // 483
const SVG_H = GRID_ROWS * CELL_STEP - (CELL_STEP - CELL_SIZE)  // 361

const DEMAND_TYPES = new Set(['house', 'wfh_house', 'office', 'grocery'])

const flowWidth = energy => Math.max(1, Math.min(7, energy * 12))

function FlowLine({ x1, y1, x2, y2, color, width, delay = 0, opacity = 0.72, animate = true }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color}
      strokeWidth={width}
      strokeDasharray="9 5"
      strokeLinecap="round"
      opacity={opacity}
      style={animate ? {
        animation: 'arrowFlow 0.9s linear infinite',
        animationDelay: `${delay}s`,
      } : undefined}
    />
  )
}

// `animate` is false once the clock stops (day over, or paused) — power should
// not keep visibly moving when the day isn't running.
export default function FlowArrows({ buildings, hourData, animate = true }) {
  if (!hourData) return null

  const utility = buildings.find(b => b.type === 'utility')
  const peaker  = buildings.find(b => b.type === 'peaker')
  const demand  = buildings.filter(b => DEMAND_TYPES.has(b.type))

  if (!utility || demand.length === 0) return null

  const utilityPerBldg = hourData.utility / demand.length
  const peakerPerBldg  = hourData.peaker  / demand.length

  const ux = cx(utility.col), uy = cy(utility.row)
  const px = peaker ? cx(peaker.col) : ux
  const py = peaker ? cy(peaker.row) : uy

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <style>{`
          @keyframes arrowFlow {
            from { stroke-dashoffset: 28; }
            to   { stroke-dashoffset: 0; }
          }
        `}</style>
      </defs>

      {demand.map((b, i) => {
        const bx = cx(b.col), by = cy(b.row)
        return (
          <g key={b.id}>
            {/* Utility → building (steel blue) */}
            {hourData.utility > 0.01 && (
              <FlowLine
                x1={ux} y1={uy} x2={bx} y2={by}
                color="#4A7EB5"
                width={flowWidth(utilityPerBldg)}
                delay={i * 0.06}
                animate={animate}
              />
            )}
            {/* Peaker → building (ember red) — only when running */}
            {hourData.peaker > 0.01 && peaker && (
              <FlowLine
                x1={px} y1={py} x2={bx} y2={by}
                color="#C45A1A"
                width={flowWidth(peakerPerBldg)}
                delay={i * 0.06 + 0.25}
                opacity={0.65}
                animate={animate}
              />
            )}
          </g>
        )
      })}

      {/* Source glow circles */}
      {hourData.utility > 0.01 && (
        <circle cx={ux} cy={uy} r={10} fill="#4A7EB5" opacity={0.25} />
      )}
      {hourData.peaker > 0.01 && peaker && (
        <circle cx={px} cy={py} r={10} fill="#C45A1A" opacity={0.22} />
      )}

      {/* Shortfall halo on demand buildings during brownout hours */}
      {hourData.shortfall > 0.01 && demand.map(b => (
        <circle
          key={`sf-${b.id}`}
          cx={cx(b.col)} cy={cy(b.row)}
          r={14}
          fill="none"
          stroke="#B5421A"
          strokeWidth={2}
          opacity={0.5}
          strokeDasharray="3 3"
        />
      ))}
    </svg>
  )
}
