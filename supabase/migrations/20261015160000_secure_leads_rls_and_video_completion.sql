-- =====================================================================
-- PENDUGPT MASTERCLASS — SECURE LEADS RLS & VIDEO COMPLETION HARDENING
-- Target Database: Landing Page Supabase (gifxzzrbpukpxsvmhokj)
-- =====================================================================

-- 1. Enable Row Level Security (RLS) on public.leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 2. Revoke direct write access from anonymous and authenticated users
-- All mutations must be executed strictly via server-side service_role functions.
REVOKE INSERT, UPDATE, DELETE ON public.leads FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.leads FROM authenticated;

-- 3. Ensure service_role maintains full administrative access
GRANT ALL ON public.leads TO service_role;

-- 4. Policy for service_role access (fails closed for anon/authenticated)
DROP POLICY IF EXISTS "Service role full access on leads" ON public.leads;
CREATE POLICY "Service role full access on leads"
  ON public.leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Optional Check Constraint: Ensure watch_seconds is non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_leads_watch_seconds_positive'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT chk_leads_watch_seconds_positive
      CHECK (watch_seconds >= 0);
  END IF;
END $$;
