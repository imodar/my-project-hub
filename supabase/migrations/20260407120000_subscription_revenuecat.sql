-- Add RevenueCat customer ID to profiles for linking app users to RevenueCat subscribers
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS revenuecat_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_revenuecat_customer_id
  ON public.profiles(revenuecat_customer_id)
  WHERE revenuecat_customer_id IS NOT NULL;

-- Subscription system settings (admin-configurable)
INSERT INTO public.system_settings (key, value) VALUES
  ('max_free_members',          '1'::jsonb),
  ('subscription_price_sar',    '49'::jsonb),
  ('subscription_product_id',   '"family_yearly_49sar"'::jsonb),
  ('subscription_grace_period_days', '3'::jsonb),
  ('revenuecat_android_key',    '""'::jsonb),
  ('revenuecat_ios_key',        '""'::jsonb)
ON CONFLICT (key) DO NOTHING;
