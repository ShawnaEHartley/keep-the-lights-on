// Grid layout, entity config, levers, day counter.

export const GRID_COLS  = 8
export const GRID_ROWS  = 6
export const CELL_SIZE  = 56
export const CELL_GAP   = 5
export const CELL_STEP  = CELL_SIZE + CELL_GAP  // 61 — center-to-center distance

// How many of each type a city may have. A grid has one utility connection —
// you can disconnect it (off-grid) and reconnect it, but not have two.
// Everything else is unlimited.
export const MAX_PER_TYPE = { utility: 1 }

export function atLimit(buildings, type) {
  const max = MAX_PER_TYPE[type]
  if (max == null) return false
  return buildings.filter(b => b.type === type).length >= max
}

// Roughly 1 in 5 homes works from home (spec §5). Rather than making WFH a
// separate thing to place, it's derived from the houses on the map so the
// ratio holds automatically as you add more. Every 5th house in id order is
// the WFH one — a stable rule, so placing a new house never reassigns an
// existing tile.
export const WFH_EVERY = 5

export function deriveHouseTypes(buildings) {
  let houseIndex = 0
  return buildings.map(b => {
    if (b.type !== 'house') return b
    const isWFH = (houseIndex++ % WFH_EVERY) === WFH_EVERY - 1
    return isWFH ? { ...b, type: 'wfh_house' } : b
  })
}

export const DEFAULT_CITY = {
  buildings: [
    // Scattered on purpose: each tile is a separate circuit in a different
    // part of town, not five houses on one street (see §3.5 — shedding drops
    // circuits). Position is cosmetic; the engine only counts type.
    { id: 1, type: 'house',   col: 1, row: 1 },
    { id: 2, type: 'house',   col: 3, row: 2 },
    { id: 3, type: 'house',   col: 6, row: 1 },
    { id: 4, type: 'house',   col: 2, row: 5 },
    { id: 5, type: 'house',   col: 5, row: 4 },
    { id: 6, type: 'grocery', col: 4, row: 3 },
    { id: 7, type: 'office',  col: 7, row: 2 },
    // Infrastructure — fixed, not player-placed
    { id: 8, type: 'utility', col: 7, row: 5 },
    { id: 9, type: 'peaker',  col: 8, row: 5 },
  ],
  solarUnits: [],
  batteries: [],
  // levers set the climate baseline (spec §4); actual day is sampled around these on Run Day
  levers: {
    temperature:    80,    // °F — cooling/heating baseline
    cloudCover:      0,    // % — solar availability baseline
    season:      'summer', // 'summer' | 'winter'
    modernization:  30,    // % renewable mix — sets uCap, peakCap, and baseload carbon intensity
  },
  day: 1,
}
