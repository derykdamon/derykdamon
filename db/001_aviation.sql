CREATE SCHEMA IF NOT EXISTS aviation;
CREATE TABLE IF NOT EXISTS aviation.inquiries (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  payload_hash text NOT NULL,
  rate_key text NOT NULL,
  service text NOT NULL CHECK (service IN ('flight','leasing','car','training','detailing')),
  contact jsonb NOT NULL,
  details jsonb NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','quoted','closed')),
  consent_version text NOT NULL DEFAULT 'prelaunch-2026-10',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_rate_window ON aviation.inquiries(rate_key, created_at);
CREATE TABLE IF NOT EXISTS aviation.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL UNIQUE REFERENCES aviation.inquiries(id),
  state text NOT NULL DEFAULT 'blocked' CHECK (state IN ('blocked','queued','processing','retry','sent','manual_review')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  first_attempt_at timestamptz,
  locked_until timestamptz,
  provider_id text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS outbox_ready ON aviation.notification_outbox(state, next_attempt_at);
-- One transaction owns duplicate protection, quota checks, intake, and the outbox.
-- A small global lock is deliberate for this request-only, low-volume launch.
CREATE OR REPLACE FUNCTION aviation.submit_inquiry(p_id uuid, p_reference text, p_hash text, p_rate text, p_service text, p_contact jsonb, p_details jsonb, p_notes text)
RETURNS TABLE(outcome text, reference text) LANGUAGE plpgsql AS $$
DECLARE existing aviation.inquiries%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(618274001);
  SELECT * INTO existing FROM aviation.inquiries WHERE id = p_id;
  IF FOUND THEN
    IF existing.payload_hash <> p_hash THEN RETURN QUERY SELECT 'conflict'::text, NULL::text;
    ELSE RETURN QUERY SELECT 'duplicate'::text, existing.reference; END IF;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM aviation.inquiries WHERE rate_key = p_rate AND created_at > now() - interval '1 hour') >= 5
    OR (SELECT count(*) FROM aviation.inquiries WHERE created_at > now() - interval '1 hour') >= 100 THEN
    RETURN QUERY SELECT 'rate_limited'::text, NULL::text; RETURN;
  END IF;
  INSERT INTO aviation.inquiries (id, reference, payload_hash, rate_key, service, contact, details, notes)
    VALUES (p_id, p_reference, p_hash, p_rate, p_service, p_contact, p_details, p_notes);
  INSERT INTO aviation.notification_outbox (inquiry_id) VALUES (p_id);
  RETURN QUERY SELECT 'created'::text, p_reference;
END $$;
