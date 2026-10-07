# Aviation preview operations

This feature is prelaunch inquiry intake. It does not create reservations, inventory holds, quotes, payments, lessons, leases, or operator-confirmed itineraries. Only synthetic QA submissions are approved for the protected Preview environment.

## Storage and local development

The project-specific Neon Free integration supplies `HRL_DATABASE_URL` and `HRL_DATABASE_URL_UNPOOLED` to Development and Preview. Auth is disabled. No new Production credentials are configured. Pull Development variables into ignored `.env.local`; keep an independently generated `HRL_INTAKE_SECRET` in ignored `.env.development.local` and the matching Preview scope. Never put credentials in `VITE_*` variables.

Run `npm ci`, `npm run db:aviation:migrate`, and `npm run dev`. Migrations run explicitly, never during a deployment build. The migration is additive and repeatable. The local Vite API adapter and deployed function share the same validation and persistence implementation.

`POST /api/aviation/inquiries` accepts same-origin JSON with a UUIDv4 `Idempotency-Key`. A database transaction handles duplicate detection, rate limits, inquiry storage, and creation of one blocked outbox job. Repeating the same key and normalized payload returns the same reference. Changing that payload returns 409. Quotas are five new inquiries per HMAC-derived client address per hour and 100 globally per hour; duplicates can recover references even when a quota is reached.

Browser contact/travel drafts are memory-only. This tab retains only a submission key, fingerprint, and receipt in session storage so a saved reference survives reload. After an uncertain submission and reload, re-entering the exact original details recovers the same request. If session storage is unavailable, this recovery is limited to the current page. The reference alone grants no read access. There is no request-list, public lookup, staff, cancellation, or portal API.

## Email remains disabled

`RESEND_API_KEY` is a Sending access key in Preview. Provisioning it does not enable email. Each new notification starts `blocked`; there is no scheduler or HTTP outbox trigger.

After separate sender/domain and recipient approval, an operator can run the outbox script with approved environment configuration. It requires `HRL_EMAIL_ENABLED=true`, `HRL_EMAIL_SENDER_APPROVED=true`, `HRL_EMAIL_FROM`, and an explicit `HRL_EMAIL_MODE`. Test mode also requires `HRL_EMAIL_TEST_RECIPIENT` and selects only inquiries submitted with that exact approved test address. It never reroutes other customers' jobs to a test address. Live mode additionally requires `HRL_EMAIL_LIVE_APPROVED=true`.

The worker leases batches with `FOR UPDATE SKIP LOCKED`, uses a stable Resend idempotency key, retries transient failures with backoff, and stops after five attempts. Permanent provider errors and uncertain attempts older than 20 hours require manual reconciliation. Do not reset/requeue these jobs without checking provider delivery status. Before enabling live email, add an approved scheduler, update the currently explicit “email not enabled” UI/API copy, and complete real delivery verification. No live or test emails have been authorized or sent by this implementation.

## Verification

- `npm run build`
- `npm run typecheck:api`
- `npm run test:aviation`
- `HRL_DATABASE_TEST=1 npm run test:aviation:database` — uses real Neon with synthetic records; removes only those fixture UUIDs. Email transport is mocked, so nothing is sent.
- Browser QA: all five service forms, validation, consent, back/forward, cancellation, network failure, unchanged retry, reload recovery, receipt wording, and desktop/mobile layouts.

The recovery and aviation feature branches disable Git-triggered deployments. A protected Preview is deployed deliberately using the CLI after checks. Never promote this preview or merge it to production without a separate release decision.

## Activation prerequisites

Confirm the public brand, service providers/inventory and operating model; approve sender/domain/DNS and email recipients; choose and approve portal authentication with per-customer authorization; define staff access, retention/privacy operations and cancellation handling; separately approve any payment provider, charges, inventory holds and operator confirmations. No public launch or customer intake is represented by the current protected preview.

## Dark regional experience (October 7, 2026)

The aviation landing page now uses a dark photographic design, a five-service selector, GSAP text/scroll motion, and a Three.js regional explorer. Official GSAP React, ScrollTrigger, and performance skills were read from https://github.com/greensock/gsap-skills. React code follows scoped animation cleanup, conditional loading, and accessible controls.

The 3D module loads near the explorer viewport. Rendering pauses off-screen and in hidden tabs, is capped at 30fps and device-pixel ratio 1.5, and stops when motion is paused. OS reduced-motion preferences disable animation. A geographic SVG and all destination controls remain available when WebGL or the optional chunk cannot load. The existing Mappedin and Synthesia demo routes now load their modules on navigation, keeping their runtimes out of the aviation first load.

Local photography provenance, modification notices, and licenses are in `public/aviation/ATTRIBUTION.md` and visible page credits. No competitor imagery was used. An apparent South Padre aerial was rejected because its embedded location indicated Corpus Christi. Historical photos are identified by year. Fresh owner-approved HRL/property photography or licensed drone footage would be the next media upgrade; no paid tools or subscriptions were purchased.

Research references: https://amalfijets.com/ (visual hierarchy and exploration patterns); https://gsap.com/docs/v3/ and https://gsap.com/community/standard-license/ (free commercial animation); https://threejs.org/docs/ (custom 3D); https://motion.dev/docs/react (alternative React motion); https://rive.app/docs/runtimes/web/web-js (state-driven vector animation); https://spline.design/pricing (optional visual 3D authoring, not required or installed). No additional service account is required by this implementation.
