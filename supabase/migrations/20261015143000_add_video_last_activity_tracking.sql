-- =====================================================================
-- PENDUGPT MASTERCLASS — RELIABLE VIDEO LAST ACTIVITY TRACKING
-- =====================================================================
-- Confirmed Architecture:
-- 1. PenduGPT Online / Landing Page: https://gifxzzrbpukpxsvmhokj.supabase.co
--    Contains: public.leads & public.whatsapp_campaign_logs
--    Column: public.leads.video_last_activity_at (timestamptz)
--
-- 2. PenduGPT WhatsApp-CRM: https://gzmksvmnwsgqpwwpiaba.supabase.co
--    Separate CRM application - NOT modified for this feature.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PRIMARY MIGRATION: LANDING PAGE SUPABASE (gifxzzrbpukpxsvmhokj)
-- Target: public.leads
-- ---------------------------------------------------------------------

-- Add video_last_activity_at column to public.leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS video_last_activity_at TIMESTAMPTZ;

-- Backfill existing completed leads with their completion timestamp
UPDATE public.leads
SET video_last_activity_at = video_completed_at
WHERE video_completed_at IS NOT NULL AND video_last_activity_at IS NULL;

-- Performance index for n8n inactivity queries (30-minute idle check)
CREATE INDEX IF NOT EXISTS idx_leads_video_last_activity_at
  ON public.leads (video_last_activity_at);

-- Composite index for n8n follow-up queue queries:
-- Allows instant filtering of uncompleted, unsent leads by activity cutoff
CREATE INDEX IF NOT EXISTS idx_leads_inactivity_queue
  ON public.leads (unlocked_class, whatsapp_followup_status, video_completed_at, video_last_activity_at);

-- Ensure correct permissions
GRANT ALL ON public.leads TO service_role;
GRANT ALL ON public.leads TO anon;
GRANT ALL ON public.leads TO authenticated;


-- ---------------------------------------------------------------------
-- PART 2: WEBSITE & FUNNEL SUPABASE (xlyqrzcstkxdkyvdensc)
-- Target: public.video_progress
-- ---------------------------------------------------------------------

-- Add video_last_activity_at column to public.video_progress
ALTER TABLE public.video_progress
  ADD COLUMN IF NOT EXISTS video_last_activity_at TIMESTAMPTZ DEFAULT now();

-- Performance index for sorting and activity lookups
CREATE INDEX IF NOT EXISTS idx_video_progress_last_activity
  ON public.video_progress (video_last_activity_at DESC);

-- Ensure permissions
GRANT ALL ON public.video_progress TO service_role;
