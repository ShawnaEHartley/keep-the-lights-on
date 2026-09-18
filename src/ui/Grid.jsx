import { GRID_COLS, GRID_ROWS } from '../state/cityModel.js'

const BUILDING_STYLE = {
  house:     { bg: '#D4A96A', border: '#B8874A', label: 'House',   icon: '⌂',  infra: false },
  wfh_house: { bg: '#C07848', border: '#9A5A2E', label: 'WFH',     icon: '⌂',  infra: false },
  office:    { bg: '#7A9AB5', border: '#4A6F8A', label: 'Office',  icon: '▣',  infra: false },
  grocery:   { bg: '#7AAF8A', border: '#4A7F5A', label: 'Grocery', icon: '▪',  infra: false },
  utility:   { bg: '#3A4A5A', border: '#1B2B3A', label: 'Utility', icon: '⚡', infra: true  },
  peaker:    { bg: '#6A3020', border: '#3A1008', label: 'Peaker',  icon: '🔥', infra: true  },
}

function BuildingTile({ building, shed }) {
  const s = BUILDING_STYLE[building.type] ?? { bg: '#ccc', border: '#aaa', label: building.type, icon: '?', infra: false }
  const labelColor = shed ? '#7A6A56' : s.infra ? '#9AB0C4' : '#2C1A08'
  return (
    <div title={shed ? `${s.label} — no power this hour` : s.label} style={{
      width: '100%', height: '100%',
      background: shed ? '#2A2420' : s.bg,
      border: `2px solid ${shed ? '#5A4A40' : s.border}`,
      borderRadius: s.infra ? 4 : 6,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      cursor: 'default',
      userSelect: 'none',
      opacity: shed ? 0.7 : s.infra ? 0.9 : 1,
      transition: 'background 0.35s ease, border-color 0.35s ease',
    }}>
      <span style={{ fontSize: '1.1rem', lineHeight: 1, filter: shed ? 'grayscale(1)' : 'none' }}>{s.icon}</span>
      <span style={{ fontSize: '0.55rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: labelColor, marginTop: 2, fontFamily: 'monospace' }}>
        {shed ? 'no power' : s.label}
      </span>
    </div>
  )
}

export default function Grid({ city, overlay, shedIds = [] }) {
  const { buildings } = city
  const shedSet = new Set(shedIds)

  // Build lookup: "col-row" → building
  const byPos = {}
  for (const b of buildings) byPos[`${b.col}-${b.row}`] = b

  const cells = []
  for (let row = 1; row <= GRID_ROWS; row++) {
    for (let col = 1; col <= GRID_COLS; col++) {
      cells.push({ col, row, building: byPos[`${col}-${row}`] ?? null })
    }
  }

  return (
    <div>
      {/* position:relative so FlowArrows SVG can overlay the cell area */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 56px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 56px)`,
          gap: 5,
        }}>
          {cells.map(({ col, row, building }) => (
            <div key={`${col}-${row}`} style={{
              background: building ? 'transparent' : '#E8E2D9',
              borderRadius: 6,
              border: building ? 'none' : '1px solid #D4CCC0',
            }}>
              {building && <BuildingTile building={building} shed={shedSet.has(building.id)} />}
            </div>
          ))}
        </div>
        {overlay}
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
      </div>
    </div>
  )
}
