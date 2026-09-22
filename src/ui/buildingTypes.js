// Shared visual + copy definitions for every element type on the map.
// Imported by both Grid (tiles) and Inventory (palette) so they can't drift.

import { getLoadShape } from '../engine/shapes.js'

export const BUILDING_STYLE = {
  house:     { bg: '#D4A96A', border: '#B8874A', label: 'House',   icon: '⌂',  infra: false },
  wfh_house: { bg: '#C07848', border: '#9A5A2E', label: 'WFH',     icon: '⌂',  infra: false },
  office:    { bg: '#7A9AB5', border: '#4A6F8A', label: 'Office',  icon: '▣',  infra: false },
  grocery:   { bg: '#7AAF8A', border: '#4A7F5A', label: 'Grocery', icon: '▪',  infra: false },
  utility:   { bg: '#3A4A5A', border: '#1B2B3A', label: 'Utility', icon: '⚡', infra: true  },
  peaker:    { bg: '#6A3020', border: '#3A1008', label: 'Peaker',  icon: '🔥', infra: true  },
}

// The bulb shows ALL electricity use, not just lighting — so it reads straight
// off the engine's own load curve rather than a separate made-up schedule.
// Lighting is a small slice of a building's draw; air conditioning is what
// actually drives the evening spike.
export const METERED_TYPES = new Set(['house', 'wfh_house', 'office', 'grocery'])

// Relative to this building type's own busiest hour, so every type is read
// on its own terms: 'high' | 'mid' | 'low'.
export function loadLevelAt(type, hour, season = 'summer') {
  if (!METERED_TYPES.has(type)) return null
  const shape = getLoadShape(type, season)
  const peak  = Math.max(...shape)
  if (!peak) return 'low'
  const rel = shape[hour] / peak
  return rel >= 0.72 ? 'high' : rel >= 0.42 ? 'mid' : 'low'
}

// When this type is at or near its own daily peak — used for the tooltip.
export function busiestWindow(type, season = 'summer') {
  if (!METERED_TYPES.has(type)) return null
  const shape = getLoadShape(type, season)
  const peak  = Math.max(...shape)
  const hours = shape.map((v, h) => (v / peak >= 0.72 ? h : -1)).filter(h => h >= 0)
  if (!hours.length) return null
  const fmt = h => `${String(h).padStart(2, '0')}:00`
  // Collapse consecutive hours into ranges
  const ranges = []
  let start = hours[0], prev = hours[0]
  for (let i = 1; i < hours.length; i++) {
    if (hours[i] === prev + 1) { prev = hours[i]; continue }
    ranges.push([start, prev]); start = hours[i]; prev = hours[i]
  }
  ranges.push([start, prev])
  return ranges.map(([a, b]) => `${fmt(a)}–${fmt(b + 1 > 23 ? 24 : b + 1)}`).join(', ')
}

// What each tile stands for, written for someone who has never thought about
// the power grid. One icon is a whole group of buildings, not a single one.
export const CIRCUIT_INFO = {
  house:     { title: 'A whole neighborhood', body: 'Not one house — a group of homes wired together. When power runs short, the grid switches off whole groups like this one. Neighborhoods go dark first.' },
  wfh_house: { title: 'A neighborhood working from home', body: 'Same as a regular neighborhood, but people are home all day — so it keeps using power at lunchtime instead of going quiet. These go dark first too.' },
  office:    { title: 'An office block', body: 'Busy during the day, nearly empty at night. If power runs short, offices go dark after neighborhoods but before the grocery store.' },
  grocery:   { title: 'The grocery store', body: 'Stays on as long as possible, because the freezers cannot be allowed to warm up. Real power companies protect the places people depend on most.' },
  utility:   { title: 'Your main power supply', body: 'Where most of the electricity comes from. Remove it and the city is on its own — there is a limit to how much it can send at once, and on a hot evening everyone wants power together.' },
  peaker:    { title: 'The backup gas plant', body: 'Only fires up when everything else has run out. It is the expensive, dirty way to keep the lights on — every hour it runs is gas burned and carbon in the air.' },
}
