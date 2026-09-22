import { useState } from 'react'
import { GRID_COLS, GRID_ROWS, CELL_SIZE, CELL_STEP } from '../state/cityModel.js'
import { BUILDING_STYLE, CIRCUIT_INFO, METERED_TYPES, loadLevelAt, busiestWindow } from './buildingTypes.js'

// Bulb in the tile corner showing how much electricity this building is
// drawing right now — all of it, not just lighting. Brightness tracks the
// building's own load curve. Infrastructure has no bulb.
const BULB_GLOW = {
  high: '0 0 7px rgba(255,205,90,1)',
  mid:  '0 0 3px rgba(255,205,90,0.6)',
  low:  'none',
}
const BULB_FILTER = {
  high: 'none',
  mid:  'saturate(0.7) opacity(0.75)',
  low:  'grayscale(1) opacity(0.3)',
}

function Bulb({ level, dark }) {
  if (!level) return null
  return (
    <span
      title={`electricity use: ${dark ? 'none — power is off' : level}`}
      style={{
        position: 'absolute', top: 3, right: 4,
        fontSize: '0.6rem', lineHeight: 1,
        filter: dark ? 'grayscale(1) brightness(0.45)' : BULB_FILTER[level],
        textShadow: dark ? 'none' : BULB_GLOW[level],
        transition: 'filter 0.35s ease, text-shadow 0.35s ease',
      }}
    >
      {dark || level === 'low' ? '○' : '💡'}
    </span>
  )
}

// The two plants read in opposite directions, on purpose.
//
// The utility is a tank draining: it starts full of blue — clean-ish grid
// power available — and the city drinks it down through the day. By the time
// it's ~90% grey there's almost nothing left, which is exactly when the gas
// turbine has to start.
//
// The peaker is the inverse: cold and empty, filling red as it burns. Watching
// one empty while the other fills is the whole story of an evening peak.
const PLANT_SPARE = '#5A6169'
const PLANT_FILL  = { utility: '#4A7EB5', peaker: '#C4341A' }
const PEAKER_WARM = '#C4892A'

// Real operators commit gas turbines before they're strictly needed — the
// machines take minutes to start, and systems hold operating reserve. So the
// peaker warms while the grid still has ~10% headroom, then fires for real.
const WARM_THRESHOLD = 0.9

// `use` is 0–1 utilisation. Returns how much of the tile is coloured.
function colouredFraction(type, use) {
  const u = Math.max(0, Math.min(1, use))
  return type === 'utility' ? 1 - u : u   // utility drains, peaker fills
}

function plantBackground(type, use, warming) {
  const pct = colouredFraction(type, use) * 100
  const lit = warming && type === 'peaker' ? PEAKER_WARM : PLANT_FILL[type]
  if (pct <= 0.5) return PLANT_SPARE
  if (pct >= 99.5) return lit
  return `linear-gradient(to top, ${lit} ${pct}%, ${PLANT_SPARE} ${pct}%)`
}

function BuildingTile({ building, shed, firing, warming, use, hour, season, draggable, dragging, onDragStart, onDragEnd, onHover }) {
  const s = BUILDING_STYLE[building.type] ?? { bg: '#ccc', border: '#aaa', label: building.type, icon: '?', infra: false }
  const labelColor = shed ? '#7A6A56' : s.infra ? '#D6E0E8' : '#2C1A08'
  const isPlant = use !== null && use !== undefined
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => onHover(building)}
      onMouseLeave={() => onHover(null)}
      style={{
        width: '100%', height: '100%',
        background: shed ? '#2A2420'
          : isPlant ? plantBackground(building.type, use, warming)
          : s.bg,
        border: `2px solid ${firing ? '#FF6A2A' : warming ? '#E0A23A' : shed ? '#5A4A40' : s.border}`,
        borderRadius: s.infra ? 4 : 6,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: draggable ? 'grab' : 'default',
        userSelect: 'none',
        opacity: dragging ? 0.35 : shed ? 0.7 : s.infra ? 0.9 : 1,
        animation: firing ? 'peakerFire 0.85s ease-in-out infinite' : undefined,
        transition: 'background 0.5s ease, border-color 0.35s ease, opacity 0.15s ease',
        position: 'relative',
      }}
    >
      {METERED_TYPES.has(building.type) && (
        <Bulb level={loadLevelAt(building.type, hour, season)} dark={shed} />
      )}
      <span style={{ fontSize: '1.1rem', lineHeight: 1, filter: shed ? 'grayscale(1)' : 'none' }}>{s.icon}</span>
      <span style={{ fontSize: '0.55rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: firing ? '#FFD9A0' : labelColor, marginTop: 2, fontFamily: 'monospace' }}>
        {shed ? 'no power' : firing ? 'burning' : warming ? 'warming' : s.label}
      </span>
    </div>
  )
}

const TIP_W = 232

function Tooltip({ building, shed, hour, season, modernization, use, warming }) {
  const info = CIRCUIT_INFO[building.type]
  if (!info) return null
  const level   = loadLevelAt(building.type, hour, season)
  const busiest = busiestWindow(building.type, season)

  // Anchor to the tile; flip below on the top row, and clamp horizontally so
  // edge-column tiles don't push the tooltip off the grid.
  const gridW  = GRID_COLS * CELL_STEP - (CELL_STEP - CELL_SIZE)
  const center = (building.col - 1) * CELL_STEP + CELL_SIZE / 2
  const x = Math.max(TIP_W / 2, Math.min(center, gridW - TIP_W / 2))

  const above = building.row > 1
  const y = above
    ? (building.row - 1) * CELL_STEP - 8
    : (building.row - 1) * CELL_STEP + CELL_SIZE + 8

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      transform: `translate(-50%, ${above ? '-100%' : '0'})`,
      width: TIP_W,
      background: '#1B2327',
      color: '#F5F1EA',
      borderRadius: 5,
      padding: '0.5rem 0.6rem',
      pointerEvents: 'none',
      zIndex: 30,
      boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
    }}>
      <div style={{ fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace', color: '#E0B978', marginBottom: 3 }}>
        {info.title}
      </div>
      <div style={{ fontSize: '0.7rem', lineHeight: 1.4, color: '#D8D0C4' }}>
        {info.body}
      </div>
      {level && (
        <div style={{ fontSize: '0.65rem', marginTop: 6, paddingTop: 5, borderTop: '1px solid #33403F', color: '#B9C4BE', fontFamily: 'monospace', lineHeight: 1.5 }}>
          <span style={{ color: level === 'high' ? '#FFD678' : level === 'mid' ? '#C9B98A' : '#7C8A85' }}>
            {level === 'high' ? '💡 using a lot right now' : level === 'mid' ? '💡 using some right now' : '○ using very little right now'}
          </span>
          {busiest && <><br />busiest: {busiest}</>}
          <div style={{ color: '#8A9691', marginTop: 3, fontFamily: 'Georgia, serif', fontSize: '0.66rem' }}>
            The bulb means all electricity use, not just lights. Lighting is a small slice — air conditioning is the big one, and in homes with them, EV chargers.
          </div>
        </div>
      )}
      {building.type === 'utility' && (
        <div style={{ fontSize: '0.65rem', marginTop: 6, paddingTop: 5, borderTop: '1px solid #33403F', color: '#B9C4BE', fontFamily: 'monospace', lineHeight: 1.5 }}>
          <span style={{ color: '#8FD6A0' }}>{modernization}% renewable</span>
          {' · '}{100 - modernization}% fossil
          <br />
          {use > 0.001
            ? `${Math.round(use * 100)}% used · ${Math.round((1 - use) * 100)}% still available`
            : 'idle right now'}
          <div style={{ color: '#8A9691', marginTop: 3, fontFamily: 'Georgia, serif', fontSize: '0.66rem' }}>
            Even a grid with plenty of clean power can't cover every hour with it — the cleanest sources aren't always available when demand peaks.
          </div>
        </div>
      )}
      {building.type === 'peaker' && (
        <div style={{ fontSize: '0.65rem', marginTop: 6, paddingTop: 5, borderTop: '1px solid #33403F', color: '#B9C4BE', fontFamily: 'monospace', lineHeight: 1.5 }}>
          <span style={{ color: use > 0.001 ? '#FF8A5A' : warming ? '#E0A23A' : '#7C8A85' }}>
            {use > 0.001 ? `burning — ${Math.round(use * 100)}% of capacity`
              : warming ? 'warming up — the grid is nearly maxed'
              : 'cold — not needed right now'}
          </span>
          <div style={{ color: '#8A9691', marginTop: 3, fontFamily: 'Georgia, serif', fontSize: '0.66rem' }}>
            Gas turbines take minutes to start, so they're fired up before they're strictly needed — usually once the grid is about 90% used.
          </div>
        </div>
      )}
      {shed && (
        <div style={{ fontSize: '0.65rem', marginTop: 5, color: '#E08A6A', fontFamily: 'monospace' }}>
          ● the power is off here right now
        </div>
      )}
    </div>
  )
}

export default function Grid({
  city, overlay, shedIds = [], peakerFiring = false, hour = 0, season = 'summer',
  supply = null, modernization = 30,
  drag, onDragTile, onDragEnd, onDropOnCell,
}) {
  const { buildings } = city
  const shedSet = new Set(shedIds)
  const [hovered, setHovered] = useState(null)

  // Build lookup: "col-row" → building
  const byPos = {}
  for (const b of buildings) byPos[`${b.col}-${b.row}`] = b

  const cells = []
  for (let row = 1; row <= GRID_ROWS; row++) {
    for (let col = 1; col <= GRID_COLS; col++) {
      cells.push({ col, row, building: byPos[`${col}-${row}`] ?? null })
    }
  }

  // An empty cell accepts either a new type from the palette or a moved tile
  const canDrop = cell => !!drag && !cell.building

  // Per-plant gauge levels. Output is shared evenly across plants of a kind,
  // matching how the engine pools their capacity.
  const utilityCount = buildings.filter(b => b.type === 'utility').length
  const peakerCount  = buildings.filter(b => b.type === 'peaker').length
  const utilityFill  = supply && supply.uCap   > 0 ? supply.utility / supply.uCap   : 0
  const peakerFill   = supply && supply.peakCap > 0 ? supply.peaker  / supply.peakCap : 0
  const peakerWarming = !!supply && utilityFill >= WARM_THRESHOLD && peakerFill <= 0.001

  // Utilisation 0–1 for a plant tile; null for anything that isn't a plant.
  const useFor = b =>
    b.type === 'utility' ? (utilityCount ? utilityFill : 0)
    : b.type === 'peaker' ? (peakerCount ? peakerFill : 0)
    : null

  // Constrain to the grid's own width so the legend can't stretch this
  // container and shove the inventory panel off to the right.
  const gridWidth = GRID_COLS * CELL_STEP - (CELL_STEP - CELL_SIZE)

  return (
    <div style={{ width: gridWidth }}>
      <style>{`
        @keyframes peakerFire {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,106,42,0.55); }
          50%      { box-shadow: 0 0 0 7px rgba(255,106,42,0); }
        }
      `}</style>

      {/* position:relative so FlowArrows SVG and the tooltip can overlay the cells */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_SIZE}px)`,
          gap: 5,
        }}>
          {cells.map(cell => {
            const { col, row, building } = cell
            const open = canDrop(cell)
            return (
              <div
                key={`${col}-${row}`}
                onDragOver={open ? e => e.preventDefault() : undefined}
                onDrop={open ? e => { e.preventDefault(); onDropOnCell(col, row) } : undefined}
                style={{
                  background: building ? 'transparent' : open ? '#DCE8DC' : '#E8E2D9',
                  borderRadius: 6,
                  border: building ? 'none' : `1px ${open ? 'dashed #7AAF8A' : 'solid #D4CCC0'}`,
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
              >
                {building && (
                  <BuildingTile
                    building={building}
                    shed={shedSet.has(building.id)}
                    firing={peakerFiring && building.type === 'peaker'}
                    warming={building.type === 'peaker' && peakerWarming}
                    use={useFor(building)}
                    hour={hour}
                    season={season}
                    draggable
                    dragging={drag?.kind === 'move' && drag.id === building.id}
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragTile(building.id) }}
                    onDragEnd={onDragEnd}
                    onHover={setHovered}
                  />
                )}
              </div>
            )
          })}
        </div>
        {overlay}
        {hovered && !drag && (
          <Tooltip building={hovered} shed={shedSet.has(hovered.id)} hour={hour} season={season}
            modernization={modernization} use={useFor(hovered)} warming={hovered.type === 'peaker' && peakerWarming} />
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(BUILDING_STYLE).filter(([, s]) => !s.infra).map(([type, s]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.bg, border: `1px solid ${s.border}` }} />
            <span style={{ fontSize: '0.68rem', color: '#7A6A56', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{s.label}</span>
          </div>
        ))}
        <span style={{ color: '#C8C0B4', fontSize: '0.65rem' }}>|</span>
        {Object.entries(BUILDING_STYLE).filter(([, s]) => s.infra).map(([type, s]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.bg, border: `1px solid ${s.border}` }} />
            <span style={{ fontSize: '0.68rem', color: '#9A8A76', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{s.label}</span>
          </div>
        ))}
        <span style={{ flexBasis: '100%', fontSize: '0.64rem', color: '#9A8A76', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
          each tile is a group of buildings, not one · hover to see what it is · drag to move
        </span>
      </div>
    </div>
  )
}
