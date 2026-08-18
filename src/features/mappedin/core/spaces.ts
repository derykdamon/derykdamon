import type { MapData, MapView, SpaceOption } from '../types/mappedinTypes'

type NormalizeSpacesOptions = {
  useActualFloorName?: boolean
}

function safeName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function normalizeSpaces(
  mapData: MapData,
  fallbackFloorName: string,
  options: NormalizeSpacesOptions = {},
): SpaceOption[] {
  const useActualFloorName = options.useActualFloorName ?? true

  return mapData
    .getByType('space')
    .filter((space) => safeName(space.name, '').length > 0)
    .map((space) => ({
      id: String(space.id),
      name: safeName(space.name, 'Unnamed mapped space'),
      floorName: useActualFloorName
        ? safeName(space.floor?.name, fallbackFloorName)
        : fallbackFloorName,
      raw: space,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function enableSpaceInteractivity(
  mapView: MapView,
  spaces: SpaceOption[],
  hoverColor: string,
) {
  spaces.forEach((space) => {
    mapView.updateState(space.raw, {
      interactive: true,
      hoverColor,
    })
  })
}
