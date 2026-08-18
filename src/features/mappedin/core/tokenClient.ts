import type { MappedinToken, MappedinTokenPayload } from '../types/mappedinTypes'

export async function loadMappedinToken(
  fallbackErrorMessage = 'Mappedin token configuration could not be loaded.',
): Promise<MappedinToken> {
  const tokenResponse = await fetch('/api/mappedin-token')
  const tokenPayload = (await tokenResponse.json()) as MappedinTokenPayload

  if (!tokenResponse.ok || !tokenPayload.accessToken || !tokenPayload.mapId) {
    throw new Error(tokenPayload.error ?? fallbackErrorMessage)
  }

  return {
    accessToken: tokenPayload.accessToken,
    expiresIn: tokenPayload.expiresIn,
    mapId: tokenPayload.mapId,
  }
}
