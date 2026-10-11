-- =====================================================================
-- PENDUGPT - WHATSAPP CAMPAIGN DEDUPLICATION & ATOMIC LOCK SCHEMA
-- Campaign: pendugpt_class_choice
-- =====================================================================

-- 1. Create persistent campaign message/event log table
CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_canonical TEXT NOT NULL,                  -- Canonical E.164 phone (e.g. '+919817337782')
  campaign TEXT NOT NULL DEFAULT 'pendugpt_class_choice',
  status TEXT NOT NULL DEFAULT 'PROCESSING',        -- 'PROCESSING' | 'SENT' | 'FAILED' | 'UNCERTAIN'
  lead_id TEXT,                                   -- Associated CRM lead UUID/ID
  registration_id TEXT,                           -- Associated website registration UUID
  provider_message_id TEXT,                       -- WACRM / WhatsApp provider message ID
  error_message TEXT,                             -- Last known error or uncertainty reason
  attempt_count INT NOT NULL DEFAULT 1,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lock_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Unique constraint ensures only ONE claim/send record exists per phone and campaign
  CONSTRAINT uq_whatsapp_campaign_phone UNIQUE (phone_canonical, campaign),
  CONSTRAINT chk_whatsapp_campaign_status CHECK (status IN ('PROCESSING', 'SENT', 'FAILED', 'UNCERTAIN'))
);

-- 2. Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_campaign_logs_phone_campaign 
  ON public.whatsapp_campaign_logs (phone_canonical, campaign);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_status 
  ON public.whatsapp_campaign_logs (status);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_active_lock 
  ON public.whatsapp_campaign_logs (lock_expires_at) 
  WHERE status = 'PROCESSING';

-- 3. Stored Procedure: Atomic Claim / Lock Acquisition
-- Guarantees atomic mutual exclusion: two simultaneous executions CANNOT both acquire the lock.
CREATE OR REPLACE FUNCTION public.acquire_campaign_lock(
  p_phone_canonical TEXT,
  p_campaign TEXT DEFAULT 'pendugpt_class_choice',
  p_lead_id TEXT DEFAULT NULL,
  p_registration_id TEXT DEFAULT NULL,
  p_lock_timeout_seconds INT DEFAULT 300
)
RETURNS TABLE (
  acquired BOOLEAN,
  current_status TEXT,
  existing_log_id UUID,
  reason TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  v_rec public.whatsapp_campaign_logs%ROWTYPE;
BEGIN
  -- Attempt to insert new processing lock atomically
  BEGIN
    INSERT INTO public.whatsapp_campaign_logs (
      phone_canonical,
      campaign,
      status,
      lead_id,
      registration_id,
      claimed_at,
      updated_at,
      lock_expires_at,
      attempt_count
    ) VALUES (
      p_phone_canonical,
      p_campaign,
      'PROCESSING',
      p_lead_id,
      p_registration_id,
      now(),
      now(),
      now() + (p_lock_timeout_seconds || ' seconds')::interval,
      1
    )
    RETURNING * INTO v_rec;

    RETURN QUERY SELECT true, 'PROCESSING'::text, v_rec.id, 'lock_acquired'::text;
    RETURN;
  EXCEPTION WHEN unique_violation THEN
    -- A record for this (phone_canonical, campaign) already exists in the table
  END;

  -- Lock row with FOR UPDATE for concurrency safety
  SELECT * INTO v_rec
  FROM public.whatsapp_campaign_logs
  WHERE phone_canonical = p_phone_canonical AND campaign = p_campaign
  FOR UPDATE;

  -- Case A: Already SENT -> Never resend
  IF v_rec.status = 'SENT' THEN
    RETURN QUERY SELECT false, 'SENT'::text, v_rec.id, 'already_sent'::text;
    RETURN;
  END IF;

  -- Case B: UNCERTAIN -> Do not resend without prior reconciliation
  IF v_rec.status = 'UNCERTAIN' THEN
    RETURN QUERY SELECT false, 'UNCERTAIN'::text, v_rec.id, 'uncertain_previous_send'::text;
    RETURN;
  END IF;

  -- Case C: PROCESSING and lock still active -> Concurrent execution in flight
  IF v_rec.status = 'PROCESSING' AND v_rec.lock_expires_at > now() THEN
    RETURN QUERY SELECT false, 'PROCESSING'::text, v_rec.id, 'concurrent_lock_active'::text;
    RETURN;
  END IF;

  -- Case D: PROCESSING and lock has expired (Stale lock)
  -- Mark as UNCERTAIN so message is NOT blindly duplicated
  IF v_rec.status = 'PROCESSING' AND v_rec.lock_expires_at <= now() THEN
    UPDATE public.whatsapp_campaign_logs
    SET status = 'UNCERTAIN',
        updated_at = now(),
        error_message = 'Previous execution timed out without send confirmation'
    WHERE id = v_rec.id;

    RETURN QUERY SELECT false, 'UNCERTAIN'::text, v_rec.id, 'stale_lock_marked_uncertain'::text;
    RETURN;
  END IF;

  -- Case E: FAILED -> Safe retry allowed
  IF v_rec.status = 'FAILED' THEN
    UPDATE public.whatsapp_campaign_logs
    SET status = 'PROCESSING',
        lead_id = COALESCE(p_lead_id, v_rec.lead_id),
        registration_id = COALESCE(p_registration_id, v_rec.registration_id),
        claimed_at = now(),
        updated_at = now(),
        lock_expires_at = now() + (p_lock_timeout_seconds || ' seconds')::interval,
        attempt_count = v_rec.attempt_count + 1,
        error_message = NULL
    WHERE id = v_rec.id;

    RETURN QUERY SELECT true, 'PROCESSING'::text, v_rec.id, 'lock_reacquired_after_failure'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, v_rec.status, v_rec.id, 'unhandled_status'::text;
END;
$$;

-- 4. Stored Procedure: Finalize Campaign Send & Reconcile CRM
CREATE OR REPLACE FUNCTION public.finalize_campaign_send(
  p_phone_canonical TEXT,
  p_campaign TEXT DEFAULT 'pendugpt_class_choice',
  p_status TEXT DEFAULT 'SENT',
  p_provider_message_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  success BOOLEAN,
  final_status TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  v_national_phone TEXT;
BEGIN
  -- Extract last 10 digits for legacy CRM compatibility
  v_national_phone := SUBSTRING(REGEXP_REPLACE(p_phone_canonical, '\D', '', 'g') FROM '\d{10}$');

  -- Update campaign log
  UPDATE public.whatsapp_campaign_logs
  SET status = p_status,
      provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
      error_message = p_error_message,
      sent_at = CASE WHEN p_status = 'SENT' THEN now() ELSE sent_at END,
      updated_at = now(),
      metadata = metadata || p_metadata
  WHERE phone_canonical = p_phone_canonical AND campaign = p_campaign;

  -- If successfully SENT, update ALL matching CRM lead records at the contact level
  IF p_status = 'SENT' THEN
    UPDATE public.leads
    SET whatsapp_followup_status = 'SENT',
        whatsapp_followup_sent_at = COALESCE(whatsapp_followup_sent_at, now())
    WHERE phone = p_phone_canonical
       OR (v_national_phone IS NOT NULL AND phone = v_national_phone);
  END IF;

  RETURN QUERY SELECT true, p_status;
END;
$$;

-- 5. Permissions
GRANT ALL ON public.whatsapp_campaign_logs TO service_role;
GRANT ALL ON public.whatsapp_campaign_logs TO anon;
GRANT ALL ON public.whatsapp_campaign_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_campaign_lock TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_campaign_send TO service_role, anon, authenticated;
