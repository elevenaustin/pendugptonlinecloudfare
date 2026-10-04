-- =====================================================================
-- PENDUGPT MASTERCLASS — LEAD STATUS & CRM ENHANCEMENTS
-- =====================================================================

-- Add CRM tracking columns to registrations table
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- Create indexes for fast filtering in Admin Panel
CREATE INDEX IF NOT EXISTS idx_registrations_is_read ON public.registrations(is_read);
CREATE INDEX IF NOT EXISTS idx_registrations_lead_status ON public.registrations(lead_status);
CREATE INDEX IF NOT EXISTS idx_registrations_last_contacted_at ON public.registrations(last_contacted_at DESC);

-- Ensure service_role has full permissions
GRANT ALL ON public.registrations TO service_role;
