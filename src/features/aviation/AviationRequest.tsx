import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Compass } from 'lucide-react'
import { inquirySchema, isService, services, type Service } from './requestSchema'
import { fingerprint, readSubmission, saveSubmission } from './submissionSession'
import './aviation.css'

const initial = { name: '', email: '', phone: '', notes: '', consent: false, website: '' }
const defaults: Record<Service, Record<string, string | number>> = {
  flight: { from: 'Harlingen (HRL)', to: '', departure: '', returnDate: '', passengers: 1 },
  leasing: { space: 'both', size: '', timing: '' },
  car: { arrival: '', flight: '', passengers: 1, preference: 'flexible' },
  training: { goal: 'introduction', experience: '' },
  detailing: { aircraft: '', location: 'Harlingen (HRL)', care: 'both', date: '' },
}
const labels: Record<string, string> = { from: 'Departure airport / city', to: 'Destination airport / city', departure: 'Preferred departure date', returnDate: 'Return date (optional)', passengers: 'Number of travelers', space: 'Space of interest', size: 'Approximate space needs (optional)', timing: 'Preferred timing', arrival: 'Arrival date', flight: 'Flight / arrival notes (optional)', preference: 'Vehicle preference', goal: 'Learning goal', experience: 'Your flying experience', aircraft: 'Aircraft type', location: 'Service location', care: 'Care requested', date: 'Preferred date (optional)' }
const options: Record<string, [string, string][]> = { space: [['both', 'Office and hangar'], ['office', 'Office'], ['hangar', 'Hangar']], preference: [['flexible', 'Flexible'], ['sedan', 'Sedan'], ['suv', 'SUV'], ['accessibility', 'Accessibility requirements']], goal: [['introduction', 'An introduction to flying'], ['private', 'Private pilot interest'], ['instrument', 'Instrument training interest'], ['other', 'Another goal']], care: [['both', 'Interior and exterior'], ['exterior', 'Exterior'], ['interior', 'Interior']] }
const human = (key: string, value: string | number) => options[key]?.find(([id]) => id === value)?.[1] ?? String(value || 'Not specified')

export default function AviationRequest() {
  const [params, setParams] = useSearchParams()
  const serviceParam = params.get('service')
  const service: Service = isService(serviceParam) ? serviceParam : 'flight'
  const stepParam = params.get('step')
  const step = stepParam === 'contact' || stepParam === 'review' ? stepParam : 'details'
  const [contact, setContact] = useState(initial)
  const [details, setDetails] = useState(defaults)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [cancel, setCancel] = useState(false)
  const [previous, setPrevious] = useState(readSubmission)
  const [receipt, setReceipt] = useState<string | null>(() => readSubmission()?.reference ?? null)
  const [uncertain, setUncertain] = useState(false)
  const submission = useRef<{ key: string; payload: string } | null>(null)
  const submitting = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const message = useRef<HTMLDivElement>(null)
  const selected = services[service]
  useEffect(() => { document.title = 'Plan an inquiry · HRL Aviation'; heading.current?.focus() }, [step, service, receipt])
  useEffect(() => { if (Object.keys(errors).length) message.current?.focus() }, [errors])
  const payload = () => ({ ...contact, service, details: details[service] })
  const go = (next: string) => { setErrors({}); setParams({ service, step: next }) }
  const validate = (scope?: string) => {
    const parsed = inquirySchema.safeParse(payload())
    if (parsed.success) { setErrors({}); return true }
    const issues = parsed.error.issues.filter(issue => !scope || (scope === 'details' ? issue.path[0] === 'details' : issue.path[0] !== 'details'))
    setErrors(Object.fromEntries(issues.map(issue => [issue.path.join('.'), issue.message])))
    return issues.length === 0
  }
  async function send() {
    if (submitting.current || (!uncertain && !validate())) return
    submitting.current = true; setBusy(true); setErrors({})
    const body = uncertain && submission.current ? submission.current.payload : JSON.stringify(inquirySchema.parse(payload()))
    try {
      const hash = await fingerprint(body)
      if (previous && !previous.reference && previous.fingerprint !== hash) {
        setErrors({ request: 'A previous submission may already be saved. Re-enter its original details to recover the reference; these details do not match.' })
        return
      }
      if (!submission.current || submission.current.payload !== body) submission.current = { key: previous?.key ?? crypto.randomUUID(), payload: body }
      const pending = { key: submission.current.key, fingerprint: hash }
      saveSubmission(pending); setPrevious(pending)
      const response = await fetch('/api/aviation/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submission.current.key }, body: submission.current.payload, signal: AbortSignal.timeout(20000) })
      const data = await response.json()
      if (!response.ok || typeof data.reference !== 'string') {
        setErrors({ request: data.error || 'Unable to submit this request. Please try again.', ...Object.fromEntries((data.fields ?? []).map((item: { field: string; message: string }) => [item.field, item.message])) })
        setUncertain(response.status >= 500)
        if (response.status < 500 && response.status !== 409) { saveSubmission(null); setPrevious(null) }
        return
      }
      saveSubmission({ ...pending, reference: data.reference })
      setReceipt(data.reference); setUncertain(false)
    } catch { setUncertain(true); setErrors({ request: 'We could not confirm the result. Keep these details unchanged and retry; the same submission key prevents a duplicate.' }) }
    finally { submitting.current = false; setBusy(false) }
  }
  function next(event: FormEvent) { event.preventDefault(); if (step === 'review') void send(); else if (validate(step)) go(step === 'details' ? 'contact' : 'review') }
  const updateDetail = (key: string, value: string | number) => setDetails(current => ({ ...current, [service]: { ...current[service], [key]: value } }))
  const errorFor = (name: string) => errors[name] ? <small className="av-field-error" id={`error-${name}`}>{errors[name]}</small> : null
  function restart() { saveSubmission(null); setPrevious(null); setReceipt(null); setContact(initial); setDetails(defaults); submission.current = null; setUncertain(false); go('details') }

  return <div className="aviation av-request"><div className="av-wrap"><div className="av-request-top"><Link to="/aviation" className="av-wordmark"><Compass size={23} strokeWidth={1.2} /> HRL AVIATION</Link><span>PRELAUNCH INQUIRIES</span></div>
    {receipt ? <section className="av-receipt"><CheckCircle2 size={38} strokeWidth={1.2} /><p className="av-eyebrow">YOUR INQUIRY IS SAVED</p><h1 ref={heading} tabIndex={-1}>A good place<br /><em>to begin.</em></h1><p>Your reference</p><strong className="av-reference">{receipt}</strong><p>This is a saved inquiry, not a reservation, quote, inventory hold, or operator-confirmed itinerary.</p><div className="av-notice">Email acknowledgements are not yet enabled. Save this reference now; it is not a public lookup code. A response time is not guaranteed during prelaunch.</div><div className="av-form-actions"><Link className="av-button av-button-dark" to="/aviation">Back to HRL Aviation <ArrowRight size={17} /></Link><button type="button" className="av-text-link" onClick={restart}>Start another inquiry</button></div></section> : <div className="av-request-layout"><aside><p className="av-eyebrow">LET’S GET THE DETAILS RIGHT</p><h1>Begin with<br /> <em>your plans.</em></h1><p>Tell us what you have in mind. We’ll save your inquiry and give you a reference.</p><div className="av-sidebar-note"><span>REQUEST ONLY</span><p>Services are in development. No payment is collected and no availability is promised.</p><p>Please leave out passport details, dates of birth, payment information, and other sensitive traveler data.</p></div><Link className="av-text-link" to="/aviation"><ArrowLeft size={16} /> Explore the concept</Link></aside>
    <section className="av-form-panel"><ol className="av-form-progress">{['details', 'contact', 'review'].map((item, index) => <li key={item} aria-current={step === item ? 'step' : undefined}><span>{index + 1}</span>{item === 'details' ? 'Your plans' : item === 'contact' ? 'Contact' : 'Review'}</li>)}</ol><h2 ref={heading} tabIndex={-1}>{step === 'details' ? selected.label : step === 'contact' ? 'How can we reach you?' : 'A final look.'}</h2><p className="av-form-intro">{step === 'details' ? selected.description : step === 'contact' ? 'Use the contact information you would like associated with this inquiry.' : 'Check the details below before saving your inquiry.'}</p>
    {Object.keys(errors).length > 0 && <div className="av-error" role="alert" ref={message} tabIndex={-1}>{errors.request ?? 'Please check the marked fields before continuing.'}{Object.entries(errors).filter(([key]) => key !== 'request').map(([key, text]) => <p key={key}>{labels[key.replace('details.', '')] ?? key}: {text}</p>)}</div>}
    {previous && !receipt && !uncertain && <p className="av-notice">A previous submission may have been saved. Re-enter the same details to recover its reference. Contact and travel details are not kept in this browser after a reload.</p>}
    <form onSubmit={next} noValidate><fieldset disabled={busy || uncertain} className="av-fieldset">
      {step === 'details' && <><label className="av-field">Service<select value={service} onChange={event => { if (isService(event.target.value)) { setErrors({}); setParams({ service: event.target.value, step: 'details' }) } }}>{Object.entries(services).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label><div className="av-fields">{Object.entries(details[service]).map(([key, value]) => <label className="av-field" key={key}>{labels[key]}{options[key] ? <select aria-label={labels[key]} value={value} onChange={event => updateDetail(key, event.target.value)}>{options[key].map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select> : <input aria-label={labels[key]} type={key === 'passengers' ? 'number' : /date|departure|arrival/i.test(key) ? 'date' : 'text'} value={value} min={key === 'passengers' ? 1 : undefined} max={key === 'passengers' ? service === 'flight' ? 20 : 8 : undefined} maxLength={key === 'experience' ? 300 : 120} aria-invalid={!!errors[`details.${key}`]} aria-describedby={errors[`details.${key}`] ? `error-details.${key}` : undefined} onChange={event => updateDetail(key, key === 'passengers' ? Number(event.target.value) : event.target.value)} />}{errorFor(`details.${key}`)}</label>)}</div><label className="av-field">Anything else? (optional)<textarea rows={3} maxLength={1000} value={contact.notes} placeholder="Share preferences, not sensitive personal information." onChange={event => setContact(current => ({ ...current, notes: event.target.value }))} /></label><p className="av-fine">Dates express preferences only. All services require review.</p></>}
      {step === 'contact' && <><div className="av-fields">{(['name', 'email', 'phone'] as const).map(key => <label className="av-field" key={key}>{key === 'name' ? 'Full name' : key === 'email' ? 'Email address' : 'Phone (optional)'}<input aria-label={key === 'name' ? 'Full name' : key === 'email' ? 'Email address' : 'Phone (optional)'} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} autoComplete={key === 'phone' ? 'tel' : key} value={contact[key]} maxLength={key === 'email' ? 254 : key === 'phone' ? 40 : 100} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={event => setContact(current => ({ ...current, [key]: event.target.value }))} />{errorFor(key)}</label>)}</div><div className="av-honeypot" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={contact.website} onChange={event => setContact(current => ({ ...current, website: event.target.value }))} /></label></div><label className="av-consent"><input type="checkbox" checked={contact.consent} onChange={event => setContact(current => ({ ...current, consent: event.target.checked }))} /><span>I understand this is a prelaunch inquiry, not a reservation. I agree that these details may be stored and used to respond to this request.</span></label>{errorFor('consent')}<p className="av-fine">Your details are used for this inquiry. This does not subscribe you to marketing. Email acknowledgements are not yet enabled.</p></>}
      {step === 'review' && <div className="av-review"><h3>{selected.label}</h3><dl>{Object.entries(details[service]).map(([key, value]) => <div key={key}><dt>{labels[key]}</dt><dd>{human(key, value)}</dd></div>)}<div><dt>Contact</dt><dd>{contact.name}<br />{contact.email}{contact.phone && <><br />{contact.phone}</>}</dd></div>{contact.notes && <div><dt>Notes</dt><dd>{contact.notes}</dd></div>}</dl><div className="av-notice"><Check size={17} /> Submitting saves an inquiry. It does not reserve a flight, vehicle, space, lesson, or detailing appointment.</div></div>}
    </fieldset>
    {uncertain && <p className="av-notice">Editing is paused because a previous attempt may have reached the server. Retry this same request to recover its reference.</p>}
    <div className="av-form-actions">{step !== 'details' && <button className="av-text-link" type="button" disabled={busy || uncertain} onClick={() => go(step === 'review' ? 'contact' : 'details')}><ArrowLeft size={16} /> Back</button>}<button className="av-button av-button-dark" disabled={busy} type="submit">{busy ? 'Saving your inquiry…' : uncertain ? 'Retry same request' : step === 'review' ? 'Save my inquiry' : 'Continue'}{!busy && <ArrowRight size={17} />}</button></div>
    </form><button className="av-cancel" type="button" disabled={busy} onClick={() => setCancel(true)}>Cancel this inquiry</button>{cancel && <div className="av-cancel-confirm" role="alert"><p>{uncertain ? 'A previous submission may already have been saved. Leaving will not cancel a saved inquiry.' : 'Discard this unsent inquiry? Your entered details will be cleared.'}</p><Link className="av-text-link" to="/aviation">{uncertain ? 'Leave without a reference' : 'Discard and leave'}</Link><button type="button" className="av-text-link" onClick={() => setCancel(false)}>Keep working</button></div>}</section></div>}
  </div></div>
}
