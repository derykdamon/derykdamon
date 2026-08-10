import type { VercelRequest, VercelResponse } from '@vercel/node'

type CreateRequest = {
  templateId?: string
  templateData?: Record<string, string>
  title?: string
  description?: string
  test?: boolean
  visibility?: 'private' | 'public'
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.SYNTHESIA_API_KEY

  if (!apiKey) {
    return response.status(500).json({
      error: 'Synthesia API key is not configured.',
      code: 'SYNTHESIA_NOT_CONFIGURED',
    })
  }

  const body = request.body as CreateRequest

  if (!body?.templateId) {
    return response.status(400).json({ error: 'templateId is required.' })
  }

  const payload = {
    templateId: body.templateId,
    templateData: body.templateData ?? {},
    test: body.test ?? true,
    visibility: body.visibility ?? 'private',
    ...(body.title ? { title: body.title } : {}),
    ...(body.description ? { description: body.description } : {}),
  }

  try {
    const synthesiaResponse = await fetch(
      'https://api.synthesia.io/v2/videos/fromTemplate',
      {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      },
    )

    const data = await synthesiaResponse.json()
    return response.status(synthesiaResponse.status).json(data)
  } catch (error) {
    console.error('Synthesia create video request failed:', error)
    return response.status(502).json({ error: 'Unable to reach Synthesia.' })
  }
}
