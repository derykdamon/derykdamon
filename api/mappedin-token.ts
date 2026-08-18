import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createMappedinTokenResult } from './mappedinTokenRuntime.js'

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const result = await createMappedinTokenResult(process.env)

  if (result.headers) {
    Object.entries(result.headers).forEach(([header, value]) => {
      response.setHeader(header, value)
    })
  }

  return response.status(result.status).json(result.body)
}
