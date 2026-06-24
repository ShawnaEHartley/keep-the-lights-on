import { GRID_COLS, GRID_ROWS } from '../state/cityModel.js'

const BUILDING_STYLE = {
  house:     { bg: '#D4A96A', border: '#B8874A', label: 'House',   icon: '⌂' },
  wfh_house: { bg: '#C07848', border: '#9A5A2E', label: 'WFH',     icon: '⌂' },
  office:    { bg: '#7A9AB5', border: '#4A6F8A', label: 'Office',  icon: '▣' },
  grocery:   { bg: '#7AAF8A', border: '#4A7F5A', label: 'Grocery', icon: '▪' },
}

function BuildingTile({ building }) {
  const s = BUILDING_STYLE[building.type] ?? { bg: '#ccc', border: '#aaa', label: building.type, icon: '?' }
  return (
    <div title={s.label} style={{
      width: '100%', height: '100%',
      background: s.bg,
      border: `2px solid ${s.border}`,
      borderRadius: 6,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      cursor: 'default',
      userSelect: 'none',
    }}>
      <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{s.icon}</span>
      <span style={{ fontSize: '0.55rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2C1A08', marginTop: 2, fontFamily: 'monospace' }}>{s.label}</span>
    </div>
  )
}

export default function Grid({ city }) {
  const { buildings } = city

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
            {building && <BuildingTile building={building} />}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
        {Object.entries(BUILDING_STYLE).map(([type, s]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.bg, border: `1px solid ${s.border}` }} />
            <span style={{ fontSize: '0.68rem', color: '#7A6A56', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
