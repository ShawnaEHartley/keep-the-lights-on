// Inventory palette — sits to the right of the grid.
// Drag a type OUT to add it to the city; drag a tile back IN to delete it.

import { BUILDING_STYLE, CIRCUIT_INFO } from './buildingTypes.js'
import { atLimit } from '../state/cityModel.js'

// The five element types this version of the city is built from.
export const INVENTORY_TYPES = ['house', 'grocery', 'office', 'utility', 'peaker']

function PaletteItem({ type, count, maxed, onDragStart, onDragEnd, dragging }) {
  const s = BUILDING_STYLE[type]
  const info = CIRCUIT_INFO[type]
  return (
    <div
      draggable={!maxed}
      onDragStart={maxed ? undefined : e => { e.dataTransfer.effectAllowed = 'copy'; onDragStart(type) }}
      onDragEnd={onDragEnd}
      title={maxed ? 'A city has one utility connection — remove it to go off-grid' : info?.title}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.55rem',
        padding: '0.45rem 0.5rem',
        borderRadius: 6,
        cursor: maxed ? 'not-allowed' : 'grab',
        opacity: dragging ? 0.4 : maxed ? 0.45 : 1,
        background: '#EFEBE3',
        border: '1px solid #DDD5C9',
        transition: 'opacity 0.15s ease',
      }}
    >
      <div style={{
        width: 32, height: 32, flexShrink: 0,
        background: s.bg,
        border: `2px solid ${s.border}`,
        borderRadius: s.infra ? 3 : 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.85rem',
      }}>
        {s.icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '0.66rem', fontFamily: 'monospace', color: '#1B2327',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          {s.label}
        </div>
        <div style={{ fontSize: '0.6rem', color: maxed ? '#B5421A' : '#9A8A76', fontFamily: 'monospace' }}>
          {maxed ? 'max 1 — on map' : `${count} on map`}
        </div>
      </div>
    </div>
  )
}

export default function Inventory({ city, drag, onDragNew, onDragEnd, onDeleteBuilding }) {
  const counts = {}
  for (const t of INVENTORY_TYPES) counts[t] = 0
  for (const b of city.buildings) if (t_has(counts, b.type)) counts[b.type]++

  // A tile being dragged off the map can be dropped here to delete it
  const armed = drag?.kind === 'move'

  return (
    <div style={{ width: 186, flexShrink: 0 }}>
      <div style={{
        fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase',
        color: '#9A8A76', marginBottom: '0.6rem', fontFamily: 'monospace',
      }}>
        Inventory
      </div>

      <div
        onDragOver={armed ? e => e.preventDefault() : undefined}
        onDrop={armed ? e => { e.preventDefault(); onDeleteBuilding(drag.id) } : undefined}
        style={{
          background: armed ? '#F3DED4' : '#E8E2D9',
          border: `1.5px ${armed ? 'dashed #B5421A' : 'solid #D4CCC0'}`,
          borderRadius: 8,
          padding: '0.6rem',
          display: 'flex', flexDirection: 'column', gap: '0.4rem',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        {INVENTORY_TYPES.map(type => (
          <PaletteItem
            key={type}
            type={type}
            count={counts[type]}
            maxed={atLimit(city.buildings, type)}
            dragging={drag?.kind === 'new' && drag.type === type}
            onDragStart={onDragNew}
            onDragEnd={onDragEnd}
          />
        ))}

        <div style={{
          marginTop: '0.2rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid #D4CCC0',
          fontSize: '0.6rem',
          color: armed ? '#B5421A' : '#9A8A76',
          fontFamily: 'monospace',
          lineHeight: 1.5,
          textAlign: 'center',
        }}>
          {armed ? 'drop here to remove' : 'drag out to add · drag back to remove'}
        </div>
      </div>
    </div>
  )
}

function t_has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key) }
