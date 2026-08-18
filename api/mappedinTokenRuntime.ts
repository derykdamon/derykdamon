type MappedinTokenEnvironment = {
  MAPPEDIN_KEY?: string
  MAPPEDIN_SECRET?: string
  MAPPEDIN_MAP_ID?: string
}

type MappedinAuthResponse = {
  access_token?: string
  expires_in?: number
  error?: string
}

export type MappedinTokenPayload = {
  accessToken?: string
  expiresIn?: number
  mapId?: string
  error?: string
}

export type MappedinTokenResult = {
  status: number
  headers?: Record<string, string>
  body: MappedinTokenPayload
}

async function readMappedinAuthResponse(
  response: Response,
): Promise<MappedinAuthResponse> {
  try {
    return (await response.json()) as MappedinAuthResponse
  } catch {
    return {}
  }
}

export async function createMappedinTokenResult(
  environment: MappedinTokenEnvironment,
): Promise<MappedinTokenResult> {
  const key = environment.MAPPEDIN_KEY
  const secret = environment.MAPPEDIN_SECRET
  const mapId = environment.MAPPEDIN_MAP_ID

  if (!key || !secret || !mapId) {
    return {
      status: 500,
      body: {
        error: 'Mappedin credentials or map ID are not configured.',
      },
    }
  }

  try {
    const mappedinResponse = await fetch(
      'https://app.mappedin.com/api/v1/api-key/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, secret }),
      },
    )

    const data = await readMappedinAuthResponse(mappedinResponse)

    if (!mappedinResponse.ok || !data.access_token) {
      return {
        status: mappedinResponse.status || 502,
        body: {
          error: data.error ?? 'Mappedin authentication failed.',
        },
      }
    }

    return {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
      },
      body: {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        mapId,
      },
    }
  } catch (error) {
    console.error('Mappedin token request failed:', error)

    return {
      status: 500,
      body: {
        error: 'Unable to obtain a Mappedin access token.',
      },
    }
  }
}
