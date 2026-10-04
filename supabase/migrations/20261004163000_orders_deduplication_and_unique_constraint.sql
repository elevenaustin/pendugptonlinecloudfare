-- =====================================================================
-- PENDUGPT MASTERCLASS — ORDERS DEDUPLICATION & UNIQUE CONSTRAINT
-- =====================================================================

-- Add partial unique index on razorpay_payment_id to prevent any duplicate insertions
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_razorpay_payment_id 
ON public.orders(razorpay_payment_id) 
WHERE razorpay_payment_id IS NOT NULL;
