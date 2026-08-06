import type { VercelRequest, VercelResponse } from '@vercel/node'

type MappedinTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const key = process.env.MAPPEDIN_KEY
  const secret = process.env.MAPPEDIN_SECRET
  const mapId = process.env.MAPPEDIN_MAP_ID

  if (!key || !secret || !mapId) {
    return response.status(500).json({
      error: 'Mappedin credentials or map ID are not configured.',
    })
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

    const data = (await mappedinResponse.json()) as MappedinTokenResponse

    if (!mappedinResponse.ok || !data.access_token) {
      return response.status(mappedinResponse.status || 502).json({
        error: data.error ?? 'Mappedin authentication failed.',
      })
    }

    response.setHeader(
      'Cache-Control',
      's-maxage=300, stale-while-revalidate=60',
    )

    return response.status(200).json({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      mapId,
    })
  } catch (error) {
    console.error('Mappedin token request failed:', error)

    return response.status(500).json({
      error: 'Unable to obtain a Mappedin access token.',
    })
  }
}
