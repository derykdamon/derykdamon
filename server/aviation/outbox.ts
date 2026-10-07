import { neon } from '@neondatabase/serverless'
type Environment = Record<string, string | undefined>

export async function processOutbox(env: Environment = process.env, send: typeof fetch = fetch) {
  // Shipping or provisioning the app never enables email. Sender + recipient approval
  // and a deliberate operational enablement are required before this gate can open.
  if (env.HRL_EMAIL_ENABLED !== 'true') return { enabled: false, processed: 0, sent: 0 }
  if (!env.HRL_DATABASE_URL || !env.RESEND_API_KEY || !env.HRL_EMAIL_FROM || env.HRL_EMAIL_SENDER_APPROVED !== 'true') throw new Error('Email is blocked: approved sender configuration is incomplete.')
  if (env.HRL_EMAIL_MODE !== 'test' && env.HRL_EMAIL_MODE !== 'live') throw new Error('Explicit test or live email mode is required.')
  if (env.HRL_EMAIL_MODE === 'test' && !env.HRL_EMAIL_TEST_RECIPIENT) throw new Error('An approved test recipient is required.')
  if (env.HRL_EMAIL_MODE === 'live' && env.HRL_EMAIL_LIVE_APPROVED !== 'true') throw new Error('Live customer email requires separate approval.')
  const sql = neon(env.HRL_DATABASE_URL)
  // Never auto-retry outside Resend's 24-hour idempotency window. Uncertain delivery
  // is escalated for manual reconciliation, rather than risk a second email.
  await sql`UPDATE aviation.notification_outbox SET state = 'manual_review', last_error_code = 'idempotency_window_expired' WHERE state IN ('processing','retry') AND first_attempt_at < now() - interval '20 hours'`
  const jobs = await sql`WITH picked AS (
    SELECT o.id FROM aviation.notification_outbox o JOIN aviation.inquiries i ON i.id = o.inquiry_id WHERE
      (state IN ('blocked','queued','retry') AND next_attempt_at <= now() OR state = 'processing' AND locked_until < now())
      AND attempts < 5 AND (${env.HRL_EMAIL_MODE === 'live'} OR i.contact->>'email' = ${env.HRL_EMAIL_TEST_RECIPIENT ?? ''})
      ORDER BY o.created_at LIMIT 5 FOR UPDATE OF o SKIP LOCKED
  ) UPDATE aviation.notification_outbox o SET state = 'processing', attempts = attempts + 1,
      first_attempt_at = COALESCE(first_attempt_at, now()), locked_until = now() + interval '2 minutes'
    FROM picked WHERE o.id = picked.id RETURNING o.id, o.inquiry_id, o.attempts`
  let sent = 0
  for (const job of jobs) {
    const [inquiry] = await sql`SELECT reference, contact FROM aviation.inquiries WHERE id = ${job.inquiry_id}`
    let code = 'network_error'
    try {
      const response = await send('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `hrl-inquiry-${job.id}` },
        body: JSON.stringify({ from: env.HRL_EMAIL_FROM, to: [env.HRL_EMAIL_MODE === 'test' ? env.HRL_EMAIL_TEST_RECIPIENT : inquiry.contact.email], subject: `Your HRL Aviation inquiry · ${inquiry.reference}`, text: `Your inquiry has been saved.\n\nReference: ${inquiry.reference}\n\nThis is a prelaunch inquiry, not a reservation, quote, payment confirmation, inventory hold, or operator-confirmed itinerary. Services and availability remain subject to review.\n\nHRL Aviation` }),
      })
      const body = await response.json().catch(() => ({})) as { id?: string }
      if (response.ok && typeof body.id === 'string') {
        await sql`UPDATE aviation.notification_outbox SET state = 'sent', provider_id = ${body.id}, sent_at = now(), locked_until = NULL, last_error_code = NULL WHERE id = ${job.id}`
        sent++; continue
      }
      code = `provider_${response.status}`
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        await sql`UPDATE aviation.notification_outbox SET state = 'manual_review', last_error_code = ${code}, locked_until = NULL WHERE id = ${job.id}`
        continue
      }
    } catch { /* Network/uncertain persistence failures use the original idempotency key. */ }
    const delay = Math.min(60, 2 ** Number(job.attempts))
    await sql`UPDATE aviation.notification_outbox SET state = ${Number(job.attempts) >= 5 ? 'manual_review' : 'retry'}, last_error_code = ${code}, next_attempt_at = now() + make_interval(mins => ${delay}), locked_until = NULL WHERE id = ${job.id}`
  }
  return { enabled: true, processed: jobs.length, sent }
}
