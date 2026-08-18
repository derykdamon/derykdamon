import type { FloorOption, MapData } from '../types/mappedinTypes'

type FloorSort = 'elevation-desc' | 'semantic-asc'

type NormalizeFloorsOptions = {
  sort?: FloorSort
}

function safeName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function floorRank(floor: FloorOption) {
  const name = floor.name.toLowerCase()

  if (name.includes('ground')) return -100
  if (name.includes('first')) return 1
  if (name.includes('second')) return 2
  if (name.includes('third')) return 3
  if (name.includes('fourth')) return 4
  if (name.includes('fifth')) return 5

  return floor.elevation
}

export function normalizeFloors(
  mapData: MapData,
  options: NormalizeFloorsOptions = {},
): FloorOption[] {
  const sort = options.sort ?? 'elevation-desc'
  const floors = mapData.getByType('floor').map((floor) => ({
    id: String(floor.id),
    name: safeName(floor.name, `Level ${floor.elevation ?? ''}`),
    elevation: Number(floor.elevation ?? 0),
  }))

  if (sort === 'semantic-asc') {
    return floors.sort((a, b) => floorRank(a) - floorRank(b))
  }

  return floors.sort((a, b) => b.elevation - a.elevation)
}
