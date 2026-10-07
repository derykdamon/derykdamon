import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { intake } from '../server/aviation/intake.ts'
import { processOutbox } from '../server/aviation/outbox.ts'

test('real Neon: concurrent duplicate, conflict, persistence, atomic outbox, and durable rate limit', { skip: !process.env.HRL_DATABASE_TEST }, async () => {
  const sql = neon(process.env.HRL_DATABASE_URL!)
  const ids: string[] = []
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const payload = { service: 'flight', name: 'Synthetic QA', email: 'qa@example.com', phone: '', notes: 'Synthetic integration test; not a travel request.', consent: true, website: '', details: { from: 'QA origin', to: 'QA destination', departure: tomorrow, returnDate: '', passengers: 1 } }
  const base = { method: 'POST', origin: 'https://qa.example', host: 'qa.example', contentType: 'application/json', ip: `synthetic-${randomUUID()}`, body: JSON.stringify(payload) }
  const key = randomUUID(); ids.push(key)
  try {
    const results = await Promise.all(Array.from({ length: 4 }, () => intake({ ...base, idempotencyKey: key })))
    assert.equal(results.filter(result => result.status === 201).length, 1)
    assert.equal(new Set(results.map(result => result.body.reference)).size, 1)
    assert.equal(results.every(result => result.body.emailStatus === 'not_enabled'), true)
    assert.equal((await intake({ ...base, idempotencyKey: key, body: JSON.stringify({ ...payload, name: 'Changed synthetic name' }) })).status, 409)
    const [saved] = await sql`SELECT i.service, i.contact->>'email' AS email, o.state FROM aviation.inquiries i JOIN aviation.notification_outbox o ON o.inquiry_id = i.id WHERE i.id = ${key}`
    assert.deepEqual(saved, { service: 'flight', email: 'qa@example.com', state: 'blocked' })
    for (let i = 0; i < 4; i++) { const id = randomUUID(); ids.push(id); assert.equal((await intake({ ...base, idempotencyKey: id })).status, 201) }
    const limited = randomUUID(); ids.push(limited)
    assert.equal((await intake({ ...base, idempotencyKey: limited })).status, 429)
    assert.equal((await intake({ ...base, idempotencyKey: key })).status, 200)
    const [count] = await sql`SELECT count(*)::int AS total FROM aviation.inquiries WHERE id = ANY(${ids}::uuid[])`
    assert.equal(count.total, 5)
  } finally {
    await sql.transaction([sql`DELETE FROM aviation.notification_outbox WHERE inquiry_id = ANY(${ids}::uuid[])`, sql`DELETE FROM aviation.inquiries WHERE id = ANY(${ids}::uuid[])`])
  }
})

test('real Neon outbox: test-recipient isolation, retry, stable provider key and manual review (mock transport; no emails)', { skip: !process.env.HRL_DATABASE_TEST }, async () => {
  const sql = neon(process.env.HRL_DATABASE_URL!)
  const id = randomUUID(), other = randomUUID()
  const email = `synthetic-${id}@example.com`
  const env = { HRL_DATABASE_URL: process.env.HRL_DATABASE_URL, HRL_EMAIL_ENABLED: 'true', HRL_EMAIL_MODE: 'test', HRL_EMAIL_SENDER_APPROVED: 'true', HRL_EMAIL_FROM: 'Synthetic <qa@example.com>', HRL_EMAIL_TEST_RECIPIENT: email, RESEND_API_KEY: 'mock-transport-only' }
  const keys: string[] = []
  try {
    for (const key of [id, other]) {
      await sql`INSERT INTO aviation.inquiries (id, reference, payload_hash, rate_key, service, contact, details) VALUES (${key}, ${`QA-${key}`}, 'synthetic', 'synthetic', 'training', ${JSON.stringify({email: key === id ? email : 'unrelated@example.com'})}::jsonb, '{}'::jsonb)`
      await sql`INSERT INTO aviation.notification_outbox (inquiry_id) VALUES (${key})`
    }
    const mock: typeof fetch = async (_url, init) => { keys.push(new Headers(init?.headers).get('Idempotency-Key')!); return new Response('{}', {status: 429}) }
    assert.equal((await processOutbox(env, mock)).processed, 1)
    let [row] = await sql`SELECT state, attempts FROM aviation.notification_outbox WHERE inquiry_id = ${id}`
    assert.deepEqual(row, {state:'retry', attempts:1})
    const [untouched] = await sql`SELECT state, attempts FROM aviation.notification_outbox WHERE inquiry_id = ${other}`
    assert.deepEqual(untouched, {state:'blocked', attempts:0})
    await sql`UPDATE aviation.notification_outbox SET next_attempt_at = now() WHERE inquiry_id = ${id}`
    assert.equal((await processOutbox(env, async (_url, init) => { keys.push(new Headers(init?.headers).get('Idempotency-Key')!); return new Response('mock permanent error', {status: 422}) })).sent, 0)
    ;[row] = await sql`SELECT state, attempts FROM aviation.notification_outbox WHERE inquiry_id = ${id}`
    assert.deepEqual(row, {state:'manual_review', attempts:2})
    assert.equal(keys[0], keys[1])
    await sql`UPDATE aviation.notification_outbox SET state='retry', next_attempt_at=now(), first_attempt_at=now()-interval '21 hours' WHERE inquiry_id=${id}`
    assert.equal((await processOutbox(env, async () => { throw new Error('expired job must not send') })).processed, 0)
  } finally {
    await sql.transaction([sql`DELETE FROM aviation.notification_outbox WHERE inquiry_id = ANY(${[id,other]}::uuid[])`, sql`DELETE FROM aviation.inquiries WHERE id = ANY(${[id,other]}::uuid[])`])
  }
})
