import { getMapData, show3dMap } from '@mappedin/mappedin-js'
import { loadMappedinToken } from './tokenClient'
import type { MapData, MapView, MappedinToken } from '../types/mappedinTypes'

export type MappedinLifecycle = {
  mapData: MapData
  mapView: MapView
  token: MappedinToken
}

type InitializeMappedinMapOptions = {
  tokenErrorMessage?: string
}

export async function initializeMappedinMap(
  mapElement: HTMLDivElement,
  options: InitializeMappedinMapOptions = {},
): Promise<MappedinLifecycle> {
  const token = await loadMappedinToken(options.tokenErrorMessage)
  const mapData = await getMapData({
    accessToken: token.accessToken,
    mapId: token.mapId,
  })
  const mapView = await show3dMap(mapElement, mapData)

  mapView.Camera.interactions.set({
    pan: true,
    zoom: true,
    bearingAndPitch: true,
  })

  return { mapData, mapView, token }
}
