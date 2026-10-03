-- =====================================================================
-- PENDUGPT MASTERCLASS — CORE FUNNEL SCHEMA & SECURITY POLICIES
-- =====================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. REGISTRATIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_country_code TEXT NOT NULL DEFAULT '+91',
  phone_number TEXT NOT NULL,
  gender TEXT,
  device_availability TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registrations_phone ON public.registrations(phone_country_code, phone_number);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON public.registrations(created_at DESC);

-- ---------------------------------------------------------------------
-- 2. VIDEO PROGRESS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  last_position_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0,
  completion_status BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_progress_registration ON public.video_progress(registration_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_progress_reg_video ON public.video_progress(registration_id, video_id);

-- ---------------------------------------------------------------------
-- 3. ORDERS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  selected_option TEXT NOT NULL, -- 'live' (Option 1 - ₹5,999) or 'recorded' (Option 2 - ₹2,499)
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'captured', 'failed', 'refunded'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_registration ON public.orders(registration_id);
CREATE INDEX IF NOT EXISTS idx_orders_rzp_payment ON public.orders(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(payment_status);

-- ---------------------------------------------------------------------
-- 4. FUNNEL EVENTS TABLE (Optional Analytics & Milestone Tracking)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL, -- 'funnel_landed', 'step1_submitted', 'video_started', 'video_50pct', 'video_completed', 'checkout_opened', 'payment_captured'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_event ON public.funnel_events(event_name);
CREATE INDEX IF NOT EXISTS idx_funnel_events_reg ON public.funnel_events(registration_id);

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

-- Service Role (Backend Server Functions) has full access
GRANT ALL ON public.registrations TO service_role;
GRANT ALL ON public.video_progress TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.funnel_events TO service_role;

-- Anonymous/Public Visitors:
-- By default with RLS enabled and NO public SELECT policies:
-- 1. Public visitors CANNOT list, read, search, or scrape anyone's registration data, phone numbers, video progress, or orders.
-- 2. Insertion and updates are performed exclusively through secure TanStack Start Server Functions (RPC) using the backend service_role client.
-- ---------------------------------------------------------------------
