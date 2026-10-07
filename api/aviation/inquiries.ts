import type { VercelRequest, VercelResponse } from '@vercel/node'
import { intake } from '../../server/aviation/intake.ts'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Allow', 'POST')
  const header = (name: string) => { const value = request.headers[name]; return typeof value === 'string' ? value : undefined }
  const result = await intake({ method: request.method ?? '', origin: header('origin'), host: header('host'), contentType: header('content-type'), idempotencyKey: header('idempotency-key'), ip: (header('x-vercel-forwarded-for') ?? header('x-forwarded-for') ?? 'unknown').split(',')[0].trim(), body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? null) })
  if (result.status === 429) response.setHeader('Retry-After', '3600')
  return response.status(result.status).json(result.body)
}
