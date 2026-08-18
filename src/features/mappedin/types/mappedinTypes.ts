import {
  getMapData,
  show3dMap,
  type Coordinate,
  type Marker,
  type Space,
} from '@mappedin/mappedin-js'

export type MapData = Awaited<ReturnType<typeof getMapData>>
export type MapView = Awaited<ReturnType<typeof show3dMap>>
export type MappedinCoordinate = Coordinate
export type MappedinMarker = Marker
export type MappedinSpace = Space

export type MappedinTokenPayload = {
  accessToken?: string
  expiresIn?: number
  mapId?: string
  error?: string
}

export type MappedinToken = {
  accessToken: string
  expiresIn?: number
  mapId: string
}

export type LoadState = 'loading' | 'ready' | 'error'

export type FloorOption = {
  id: string
  name: string
  elevation: number
}

export type SpaceOption = {
  id: string
  name: string
  floorName: string
  raw: MappedinSpace
}
