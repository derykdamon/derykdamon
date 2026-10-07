import { z } from 'zod'

export const services = {
  flight: { label: 'Coordinated flight', eyebrow: 'In the air', description: 'Share a route and a preferred departure. Start a conversation toward a personalized quote and, when available, an operator-confirmed itinerary.' },
  leasing: { label: 'Office & hangar space', eyebrow: 'A place to grow', description: 'Register interest in planned aviation workspace near HRL. Building plans, spaces, lease terms, and availability are still being evaluated.' },
  car: { label: 'Arrival car', eyebrow: 'On the ground', description: 'Tell us what you would need after touchdown. Vehicle partners, inventory, pricing, and checkout are not yet available.' },
  training: { label: 'Flight school interest', eyebrow: 'A new perspective', description: 'Tell us about your flying goals. Expressing interest does not enroll you in a course or schedule a lesson.' },
  detailing: { label: 'Aircraft detailing', eyebrow: 'Attention to detail', description: 'Outline the aircraft, location, and care you have in mind. Service scope and provider availability require review.' },
} as const
export type Service = keyof typeof services
export const isService = (value: string | null): value is Service => value !== null && Object.hasOwn(services, value)

const text = (max: number) => z.string().trim().min(1, 'Please complete this field.').max(max)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.').refine(value => !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value, 'Choose a valid date.')
const optionalDate = z.union([date, z.literal('')])
const common = {
  name: text(100),
  email: z.email('Enter a valid email address.').trim().toLowerCase().max(254),
  phone: z.string().trim().max(40),
  notes: z.string().trim().max(1000, 'Keep notes under 1,000 characters.'),
  consent: z.literal(true, { error: 'Please acknowledge how this request works.' }),
  website: z.literal('').optional(),
}
export const inquirySchema = z.discriminatedUnion('service', [
  z.strictObject({ ...common, service: z.literal('flight'), details: z.strictObject({ from: text(80), to: text(80), departure: date, returnDate: optionalDate, passengers: z.number().int().min(1).max(20) }) }),
  z.strictObject({ ...common, service: z.literal('leasing'), details: z.strictObject({ space: z.enum(['office', 'hangar', 'both']), size: z.string().trim().max(120), timing: text(120) }) }),
  z.strictObject({ ...common, service: z.literal('car'), details: z.strictObject({ arrival: date, flight: z.string().trim().max(80), passengers: z.number().int().min(1).max(8), preference: z.enum(['flexible', 'sedan', 'suv', 'accessibility']) }) }),
  z.strictObject({ ...common, service: z.literal('training'), details: z.strictObject({ goal: z.enum(['introduction', 'private', 'instrument', 'other']), experience: text(300) }) }),
  z.strictObject({ ...common, service: z.literal('detailing'), details: z.strictObject({ aircraft: text(120), location: text(120), care: z.enum(['exterior', 'interior', 'both']), date: optionalDate }) }),
]).superRefine((value, ctx) => {
  if (value.service === 'flight' && value.details.returnDate && value.details.returnDate < value.details.departure) ctx.addIssue({ code: 'custom', path: ['details', 'returnDate'], message: 'Return must be on or after departure.' })
  const dates = value.service === 'flight' ? [['departure', value.details.departure]] : value.service === 'car' ? [['arrival', value.details.arrival]] : value.service === 'detailing' && value.details.date ? [['date', value.details.date]] : []
  // Date-only planning requests use the airport's local day, allowing yesterday in UTC.
  const earliest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  dates.forEach(([field, value]) => { if (value < earliest) ctx.addIssue({ code: 'custom', path: ['details', field], message: 'Choose an upcoming date.' }) })
})
export type Inquiry = z.infer<typeof inquirySchema>
