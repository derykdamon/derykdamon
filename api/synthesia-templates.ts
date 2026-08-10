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

  if (!apiKey) {
    return response.status(500).json({
      error: 'Synthesia API key is not configured.',
      code: 'SYNTHESIA_NOT_CONFIGURED',
    })
  }

  const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 100)
  const offset = Math.max(Number(request.query.offset ?? 0), 0)

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })

  try {
    const synthesiaResponse = await fetch(
      `https://api.synthesia.io/v2/templates?${params.toString()}`,
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
    console.error('Synthesia template request failed:', error)
    return response.status(502).json({ error: 'Unable to reach Synthesia.' })
  }
}
