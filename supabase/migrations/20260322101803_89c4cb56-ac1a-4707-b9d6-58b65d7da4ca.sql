-- =============================================
-- الدفعة 4: جداول النظام والأدمن + Storage
-- =============================================

-- ─── trash_items ───
CREATE TABLE public.trash_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL,
  title text NOT NULL, description text,
  original_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_records jsonb DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  permanent_delete_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  restored boolean NOT NULL DEFAULT false
);
ALTER TABLE public.trash_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own trash" ON public.trash_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert to trash" ON public.trash_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trash" ON public.trash_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trash" ON public.trash_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── notification_tokens ───
CREATE TABLE public.notification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL, device_info text, platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tokens" ON public.notification_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ─── scheduled_notifications ───
CREATE TABLE public.scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, title text NOT NULL, body text,
  scheduled_at timestamptz NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications" ON public.scheduled_notifications
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ─── otp_codes ───
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- No direct client access — managed by Edge Functions only

-- ─── PDPL tables ───
CREATE TABLE public.data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  file_url text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own exports" ON public.data_export_requests
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.account_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  reason text, status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_delete_at timestamptz DEFAULT (now() + interval '30 days'),
  completed_at timestamptz
);
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own deletion" ON public.account_deletions
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.data_retention_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  retention_days int NOT NULL,
  auto_purge boolean NOT NULL DEFAULT false,
  description text
);
ALTER TABLE public.data_retention_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage retention" ON public.data_retention_policy
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ─── app_versions ───
CREATE TABLE public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  min_supported_version text NOT NULL,
  force_update boolean NOT NULL DEFAULT false,
  update_message text, release_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read app versions" ON public.app_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage app versions" ON public.app_versions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update app versions" ON public.app_versions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ─── upgrade_attempts ───
CREATE TABLE public.upgrade_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_attempted text NOT NULL, price numeric,
  step_reached text, abandoned_at timestamptz, completed_at timestamptz,
  followup_sent boolean NOT NULL DEFAULT false
);
ALTER TABLE public.upgrade_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own attempts" ON public.upgrade_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert attempts" ON public.upgrade_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ─── subscription_events ───
CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL, plan text, amount numeric, currency text DEFAULT 'SAR',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON public.subscription_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ─── Admin tables ───
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL, target_type text, target_id text,
  details jsonb DEFAULT '{}'::jsonb, ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can access audit log" ON public.admin_audit_log
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.feature_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name text NOT NULL, page_path text, session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert usage" ON public.feature_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read usage" ON public.feature_usage
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_info text, platform text, ip_address text,
  started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz
);
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions" ON public.user_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid REFERENCES auth.users(id),
  target_type text, target_id text,
  title text NOT NULL, body text,
  sent_at timestamptz NOT NULL DEFAULT now(), opened_count int DEFAULT 0
);
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can access notification log" ON public.notification_log
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage settings" ON public.system_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can read settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.rate_limit_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- Managed by Edge Functions only — no direct client access

-- ─── Storage Buckets ───
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('album-photos', 'album-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('trip-documents', 'trip-documents', false);

-- Storage policies
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own album photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'album-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload album photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'album-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own trip documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'trip-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload trip documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'trip-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── Enable Realtime for chat, market, tasks ───
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_items;