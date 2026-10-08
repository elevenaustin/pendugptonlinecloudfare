-- =====================================================================
-- PENDUGPT - WHATSAPP FOLLOW-UP TRACKING & AUTOMATION SCHEMA
-- =====================================================================

-- 1. Ensure public.leads table exists with all standard columns
CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  phone TEXT NOT NULL,
  gender TEXT,
  has_laptop TEXT,
  watch_seconds NUMERIC DEFAULT 0,
  unlocked_class BOOLEAN NOT NULL DEFAULT false,
  user_agent TEXT
);

-- 2. Add WhatsApp followup tracking & completion timestamp columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS whatsapp_followup_status TEXT NOT NULL DEFAULT 'NOT_SENT',
  ADD COLUMN IF NOT EXISTS whatsapp_followup_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_last_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS video_completed_at TIMESTAMPTZ;

-- 3. Safely backfill existing rows
UPDATE public.leads
SET whatsapp_followup_status = 'NOT_SENT'
WHERE whatsapp_followup_status IS NULL;

UPDATE public.leads
SET video_completed_at = created_at
WHERE unlocked_class = true AND video_completed_at IS NULL;

-- 4. Enforce valid WhatsApp status values via check constraint
DO 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_leads_whatsapp_followup_status'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT chk_leads_whatsapp_followup_status
      CHECK (whatsapp_followup_status IN ('NOT_SENT', 'SENT', 'REPLIED', 'STOPPED', 'PAID'));
  END IF;
END ;

-- 5. Create performance indexes for automation and queries
CREATE INDEX IF NOT EXISTS idx_leads_unlocked_class ON public.leads (unlocked_class);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_followup_status ON public.leads (whatsapp_followup_status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_video_completed_at ON public.leads (video_completed_at);
CREATE INDEX IF NOT EXISTS idx_leads_followup_queue ON public.leads (unlocked_class, whatsapp_followup_status, video_completed_at);

-- 6. Grant permissions
GRANT ALL ON public.leads TO service_role;
GRANT ALL ON public.leads TO anon;
GRANT ALL ON public.leads TO authenticated;
