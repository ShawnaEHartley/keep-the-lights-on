// Grid layout, entity config, levers, day counter.

export const GRID_COLS  = 8
export const GRID_ROWS  = 6
export const CELL_SIZE  = 56
export const CELL_GAP   = 5
export const CELL_STEP  = CELL_SIZE + CELL_GAP  // 61 — center-to-center distance

export const DEFAULT_CITY = {
  buildings: [
    { id: 1, type: 'house',   col: 1, row: 1 },
    { id: 2, type: 'house',   col: 2, row: 1 },
    { id: 3, type: 'house',   col: 3, row: 1 },
    { id: 4, type: 'house',   col: 4, row: 1 },
    { id: 5, type: 'house',   col: 5, row: 1 },
    { id: 6, type: 'grocery', col: 2, row: 3 },
    { id: 7, type: 'office',  col: 4, row: 3 },
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
