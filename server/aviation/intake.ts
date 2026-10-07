import { createHash, createHmac, randomBytes } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { inquirySchema } from '../../src/features/aviation/requestSchema.ts'

export type IntakeInput = { method: string; origin?: string; host?: string; contentType?: string; idempotencyKey?: string; ip: string; body: string }
type Environment = Record<string, string | undefined>
export async function intake(input: IntakeInput, env: Environment = process.env) {
  const result = (status: number, body: Record<string, unknown>) => ({ status, body })
  if (input.method !== 'POST') return result(405, { error: 'Use POST to submit a request.' })
  const deployed = env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'production'
  if (!input.origin || !input.host || ![`https://${input.host}`, ...(deployed ? [] : [`http://${input.host}`])].includes(input.origin)) return result(403, { error: 'Please submit from this website.' })
  if (input.contentType?.split(';')[0] !== 'application/json') return result(415, { error: 'Use a JSON request.' })
  if (Buffer.byteLength(input.body) > 12000) return result(413, { error: 'This request is too large. Please shorten your notes.' })
  if (!input.idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey)) return result(400, { error: 'Refresh the page and try again.' })
  let body: unknown
  try { body = JSON.parse(input.body) } catch { return result(400, { error: 'Invalid request format.' }) }
  const parsed = inquirySchema.safeParse(body)
  if (!parsed.success) return result(422, { error: 'Please check your request details.', fields: parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) })
  if (!env.HRL_DATABASE_URL || !env.HRL_INTAKE_SECRET) return result(503, { error: 'Requests are temporarily unavailable. Your request has not been saved. Please try again later.' })
  const { service, name, email, phone, details, notes } = parsed.data
  const payloadHash = createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex')
  const rateKey = createHmac('sha256', env.HRL_INTAKE_SECRET).update(input.ip).digest('hex')
  const reference = `HRL-${randomBytes(6).toString('hex').toUpperCase()}`
  try {
    const sql = neon(env.HRL_DATABASE_URL)
    const [row] = await sql`SELECT * FROM aviation.submit_inquiry(${input.idempotencyKey}::uuid, ${reference}, ${payloadHash}, ${rateKey}, ${service}, ${JSON.stringify({ name, email, phone })}::jsonb, ${JSON.stringify(details)}::jsonb, ${notes})`
    if (row.outcome === 'conflict') return result(409, { error: 'This request was already submitted with different details. Start a new request to make changes.' })
    if (row.outcome === 'rate_limited') return result(429, { error: 'Too many requests have been submitted. Please try again in an hour.' })
    return result(row.outcome === 'created' ? 201 : 200, { reference: row.reference, status: 'received', emailStatus: 'not_enabled', message: 'Your inquiry has been saved. This is not a reservation. Email acknowledgements are not yet enabled; please keep your reference.' })
  } catch {
    // Never log request bodies, credentials, provider errors, or contact details.
    console.error('Aviation intake database operation failed')
    return result(503, { error: 'We could not confirm your request was saved. Retry without changing your details; duplicate protection will keep one request.' })
  }
}
