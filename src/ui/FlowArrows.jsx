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
// Blend between grid blue and gas red by how much of the delivered power is
// coming from the peaker.
function mixColor(gasShare) {
  const a = [0x4A, 0x7E, 0xB5]   // grid blue
  const b = [0xC4, 0x34, 0x1A]   // gas red
  const t = Math.max(0, Math.min(1, gasShare))
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export default function FlowArrows({ buildings, hourData, animate = true }) {
  if (!hourData) return null

  // Power flows the way it really does: a building has ONE service connection,
  // fed by the grid. The peaker doesn't run its own wires to anyone's house —
  // it feeds INTO the grid, and the grid delivers the mix. So peakers draw a
  // short line to the utility, and only the utility draws lines to buildings.
  // Those lines redden as more of what's being delivered is gas.
  const utilities = buildings.filter(b => b.type === 'utility')
  const peakers   = buildings.filter(b => b.type === 'peaker')
  const demand    = buildings.filter(b => DEMAND_TYPES.has(b.type))

  if (demand.length === 0) return null

  const delivered = hourData.utility + hourData.peaker
  const gasShare  = delivered > 0.001 ? hourData.peaker / delivered : 0
  const mixed     = mixColor(gasShare)

  // With no utility tile the city is islanded — the peaker is the only supply
  // and has to feed buildings directly.
  const sources     = utilities.length ? utilities : peakers
  const perLine     = sources.length ? delivered / (demand.length * sources.length) : 0
  const peakerPerUp = peakers.length ? hourData.peaker / peakers.length : 0

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

      {/* Peaker → utility: gas feeding INTO the grid, not into houses */}
      {hourData.peaker > 0.01 && utilities.length > 0 && peakers.map((p, pi) =>
        utilities.map(u => (
          <FlowLine
            key={`pu${p.id}-${u.id}`}
            x1={cx(p.col)} y1={cy(p.row)} x2={cx(u.col)} y2={cy(u.row)}
            color="#C4341A"
            width={flowWidth(peakerPerUp)}
            delay={pi * 0.1}
            opacity={0.9}
            animate={animate}
          />
        ))
      )}

      {/* Grid → buildings: one service line each, coloured by the mix it carries */}
      {delivered > 0.01 && demand.map((b, i) => {
        const bx = cx(b.col), by = cy(b.row)
        return sources.map((s, si) => (
          <FlowLine
            key={`s${s.id}-${b.id}`}
            x1={cx(s.col)} y1={cy(s.row)} x2={bx} y2={by}
            color={mixed}
            width={flowWidth(perLine)}
            delay={i * 0.06 + si * 0.1}
            animate={animate}
          />
        ))
      })}

      {/* Source glow circles — one per plant that's actually producing */}
      {hourData.utility > 0.01 && utilities.map(u => (
        <circle key={`gu${u.id}`} cx={cx(u.col)} cy={cy(u.row)} r={10} fill={mixed} opacity={0.28} />
      ))}
      {hourData.peaker > 0.01 && peakers.map(p => (
        <circle key={`gp${p.id}`} cx={cx(p.col)} cy={cy(p.row)} r={10} fill="#C4341A" opacity={0.25} />
      ))}

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
