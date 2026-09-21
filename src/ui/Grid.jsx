import { useState } from 'react'
import { GRID_COLS, GRID_ROWS, CELL_SIZE, CELL_STEP } from '../state/cityModel.js'

const BUILDING_STYLE = {
  house:     { bg: '#D4A96A', border: '#B8874A', label: 'House',   icon: '⌂',  infra: false },
  wfh_house: { bg: '#C07848', border: '#9A5A2E', label: 'WFH',     icon: '⌂',  infra: false },
  office:    { bg: '#7A9AB5', border: '#4A6F8A', label: 'Office',  icon: '▣',  infra: false },
  grocery:   { bg: '#7AAF8A', border: '#4A7F5A', label: 'Grocery', icon: '▪',  infra: false },
  utility:   { bg: '#3A4A5A', border: '#1B2B3A', label: 'Utility', icon: '⚡', infra: true  },
  peaker:    { bg: '#6A3020', border: '#3A1008', label: 'Peaker',  icon: '🔥', infra: true  },
}

// What each tile stands for, written for someone who has never thought about
// the power grid. One icon is a whole group of buildings, not a single one.
const CIRCUIT_INFO = {
  house:     { title: 'A whole neighborhood', body: 'Not one house — a group of homes wired together. When power runs short, the grid switches off whole groups like this one. Neighborhoods go dark first.' },
  wfh_house: { title: 'A neighborhood working from home', body: 'Same as a regular neighborhood, but people are home all day — so it keeps using power at lunchtime instead of going quiet. These go dark first too.' },
  office:    { title: 'An office block', body: 'Busy during the day, nearly empty at night. If power runs short, offices go dark after neighborhoods but before the grocery store.' },
  grocery:   { title: 'The grocery store', body: 'Stays on as long as possible, because the freezers cannot be allowed to warm up. Real power companies protect the places people depend on most.' },
  utility:   { title: 'Your main power supply', body: 'Where most of the electricity comes from. There is a limit to how much it can send at once — and on a hot evening, everyone wants power at the same time.' },
  peaker:    { title: 'The backup gas plant', body: 'Only fires up when everything else has run out. It is the expensive, dirty way to keep the lights on.' },
}

function BuildingTile({ building, shed, draggable, dragging, onDragStart, onDragEnd, onHover }) {
  const s = BUILDING_STYLE[building.type] ?? { bg: '#ccc', border: '#aaa', label: building.type, icon: '?', infra: false }
  const labelColor = shed ? '#7A6A56' : s.infra ? '#9AB0C4' : '#2C1A08'
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => onHover(building)}
      onMouseLeave={() => onHover(null)}
      style={{
        width: '100%', height: '100%',
        background: shed ? '#2A2420' : s.bg,
        border: `2px solid ${shed ? '#5A4A40' : s.border}`,
        borderRadius: s.infra ? 4 : 6,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: draggable ? 'grab' : 'default',
        userSelect: 'none',
        opacity: dragging ? 0.35 : shed ? 0.7 : s.infra ? 0.9 : 1,
        transition: 'background 0.35s ease, border-color 0.35s ease, opacity 0.15s ease',
      }}
    >
      <span style={{ fontSize: '1.1rem', lineHeight: 1, filter: shed ? 'grayscale(1)' : 'none' }}>{s.icon}</span>
      <span style={{ fontSize: '0.55rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: labelColor, marginTop: 2, fontFamily: 'monospace' }}>
        {shed ? 'no power' : s.label}
      </span>
    </div>
  )
}

const TIP_W = 232

function Tooltip({ building, shed }) {
  const info = CIRCUIT_INFO[building.type]
  if (!info) return null

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
      {shed && (
        <div style={{ fontSize: '0.65rem', marginTop: 5, color: '#E08A6A', fontFamily: 'monospace' }}>
          ● the power is off here right now
        </div>
      )}
    </div>
  )
}

export default function Grid({ city, overlay, shedIds = [], onMoveBuilding }) {
  const { buildings } = city
  const shedSet = new Set(shedIds)
  const [hovered, setHovered] = useState(null)
  const [dragId,  setDragId]  = useState(null)

  // Build lookup: "col-row" → building
  const byPos = {}
  for (const b of buildings) byPos[`${b.col}-${b.row}`] = b

  const cells = []
  for (let row = 1; row <= GRID_ROWS; row++) {
    for (let col = 1; col <= GRID_COLS; col++) {
      cells.push({ col, row, building: byPos[`${col}-${row}`] ?? null })
    }
  }

  const canDrop = cell => dragId !== null && !cell.building

  return (
    <div>
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
                onDrop={open ? e => {
                  e.preventDefault()
                  onMoveBuilding?.(dragId, col, row)
                  setDragId(null)
                } : undefined}
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
                    draggable={!BUILDING_STYLE[building.type]?.infra && !!onMoveBuilding}
                    dragging={dragId === building.id}
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragId(building.id) }}
                    onDragEnd={() => setDragId(null)}
                    onHover={setHovered}
                  />
                )}
              </div>
            )
          })}
        </div>
        {overlay}
        {hovered && dragId === null && (
          <Tooltip building={hovered} shed={shedSet.has(hovered.id)} />
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
        <span style={{ marginLeft: 'auto', fontSize: '0.64rem', color: '#9A8A76', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
          each tile is a group of buildings, not one · hover to see what it is · drag to move
        </span>
      </div>
    </div>
  )
}
