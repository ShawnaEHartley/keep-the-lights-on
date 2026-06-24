// 24-hour normalized load curves. Each array sums to 1.
// Hour index 0 = midnight, 12 = noon, 23 = 11pm.

export function getLoadShape(buildingType) {
  throw new Error(`getLoadShape not yet implemented for: ${buildingType}`)
}

export function getSolarShape() {
  throw new Error('getSolarShape not yet implemented')
}
