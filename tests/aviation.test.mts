import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { inquirySchema, inquiryValidationSchema } from '../src/features/aviation/requestSchema.ts'
import { intake, type IntakeInput } from '../server/aviation/intake.ts'
import { processOutbox } from '../server/aviation/outbox.ts'

const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
const valid = { service: 'flight', name: 'QA Example', email: 'qa@example.com', phone: '', notes: '', consent: true, website: '', details: { from: 'HRL', to: 'Test destination', departure: tomorrow, returnDate: '', passengers: 2 } }
const input: IntakeInput = { method: 'POST', origin: 'http://localhost:5173', host: 'localhost:5173', contentType: 'application/json', idempotencyKey: randomUUID(), ip: 'synthetic-test', body: JSON.stringify(valid) }
test('validates service-specific data and rejects unknown or sensitive extra fields', () => {
  assert.equal(inquirySchema.safeParse(valid).success, true)
  for (const altered of [{ ...valid, passport: 'not-collected' }, { ...valid, consent: false }, { ...valid, service: 'unavailable' }, { ...valid, details: { ...valid.details, passengers: 0 } }, { ...valid, details: { ...valid.details, departure: '2027-02-30' } }]) assert.equal(inquirySchema.safeParse(altered).success, false)
})
test('validates the other four services', () => {
  for (const [service, details] of Object.entries({ leasing: { space: 'office', size: '', timing: 'Next year' }, car: { arrival: tomorrow, flight: '', passengers: 1, preference: 'flexible' }, training: { goal: 'introduction', experience: 'No experience' }, detailing: { aircraft: 'QA aircraft', location: 'HRL', care: 'both', date: '' } })) assert.equal(inquirySchema.safeParse({ ...valid, service, details }).success, true)
})
test('rejects wrong methods, cross-origin requests, malformed bodies, missing keys and invalid fields', async () => {
  for (const [patch, expected] of [[{ method: 'GET' }, 405], [{ origin: 'https://other.example' }, 403], [{ origin: undefined }, 403], [{ contentType: 'text/plain' }, 415], [{ idempotencyKey: '' }, 400], [{ body: '{' }, 400], [{ body: 'x'.repeat(12001) }, 413], [{ body: '{}' }, 422]] as [Partial<IntakeInput>, number][]) assert.equal((await intake({ ...input, ...patch }, {})).status, expected)
})
test('unavailable database configuration fails honestly without a reference', async () => {
  const result = await intake(input, {})
  assert.equal(result.status, 503); assert.equal(result.body.reference, undefined)
})
test('outbox never sends or contacts the database while disabled', async () => {
  let calls = 0
  const result = await processOutbox({}, async () => { calls++; throw new Error('must not send') })
  assert.deepEqual(result, { enabled: false, processed: 0, sent: 0 }); assert.equal(calls, 0)
})
test('outbox requires separate sender approval even when a key exists', async () => {
  await assert.rejects(() => processOutbox({ HRL_EMAIL_ENABLED: 'true', HRL_DATABASE_URL: 'unused', RESEND_API_KEY: 'not-a-real-key', HRL_EMAIL_FROM: 'test@example.com' }), /approved sender/)
})
test('client recovery accepts aged dates while new requests and malformed recovery remain invalid', () => {
  const aged = { ...valid, details: { ...valid.details, departure: '2020-10-07' } }
  assert.equal(inquiryValidationSchema(true).safeParse(aged).success, true)
  assert.equal(inquiryValidationSchema(false).safeParse(aged).success, false)
  assert.equal(inquiryValidationSchema(true).safeParse({ ...aged, consent: false }).success, false)
  assert.equal(inquiryValidationSchema(true).safeParse({ ...aged, details: { ...aged.details, departure: '2020-02-30' } }).success, false)
})
