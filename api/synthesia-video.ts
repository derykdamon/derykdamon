import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.SYNTHESIA_API_KEY
  const videoId = String(request.query.id ?? '')

  if (!apiKey) {
    return response.status(500).json({
      error: 'Synthesia API key is not configured.',
      code: 'SYNTHESIA_NOT_CONFIGURED',
    })
  }

  if (!videoId) {
    return response.status(400).json({ error: 'Video id is required.' })
  }

  try {
    const synthesiaResponse = await fetch(
      `https://api.synthesia.io/v2/videos/${encodeURIComponent(videoId)}`,
      {
        headers: {
          Authorization: apiKey,
          Accept: 'application/json',
        },
      },
    )

    const data = await synthesiaResponse.json()
    return response.status(synthesiaResponse.status).json(data)
  } catch (error) {
    console.error('Synthesia retrieve video request failed:', error)
    return response.status(502).json({ error: 'Unable to reach Synthesia.' })
  }
}
