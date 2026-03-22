
-- =============================================
-- ZAKAT ASSETS
-- =============================================
CREATE TABLE public.zakat_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  weight_grams NUMERIC,
  purchase_date TEXT,
  reminder BOOLEAN NOT NULL DEFAULT false,
  zakat_paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.zakat_assets ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ZAKAT HISTORY
-- =============================================
CREATE TABLE public.zakat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.zakat_assets(id) ON DELETE CASCADE,
  amount_paid NUMERIC NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
ALTER TABLE public.zakat_history ENABLE ROW LEVEL SECURITY;

-- =============================================
-- WILLS (E2EE)
-- =============================================
CREATE TABLE public.wills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  password_hash TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wills ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER wills_updated_at BEFORE UPDATE ON public.wills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- WILL OPEN REQUESTS
-- =============================================
CREATE TABLE public.will_open_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  will_id UUID NOT NULL REFERENCES public.wills(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_approvals INT NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.will_open_requests ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VEHICLES
-- =============================================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  year TEXT,
  mileage INT NOT NULL DEFAULT 0,
  mileage_unit TEXT NOT NULL DEFAULT 'km',
  color TEXT,
  plate_number TEXT,
  shared_with UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VEHICLE MAINTENANCE
-- =============================================
CREATE TABLE public.vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  date TEXT,
  mileage_at_service INT,
  next_mileage INT,
  next_date TEXT,
  notes TEXT
);
ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;

-- =============================================
-- MEDICATIONS
-- =============================================
CREATE TABLE public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  member_id TEXT,
  member_name TEXT,
  frequency_type TEXT,
  frequency_value INT,
  selected_days INT[] DEFAULT '{}',
  times_per_day INT DEFAULT 1,
  specific_times TEXT[] DEFAULT '{}',
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  color TEXT,
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- MEDICATION LOGS
-- =============================================
CREATE TABLE public.medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  taken_by UUID REFERENCES auth.users(id),
  skipped BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VACCINATION CHILDREN
-- =============================================
CREATE TABLE public.vaccination_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT,
  birth_date TEXT,
  completed_vaccines TEXT[] DEFAULT '{}',
  reminder_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vaccination_children ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VACCINE NOTES
-- =============================================
CREATE TABLE public.vaccine_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.vaccination_children(id) ON DELETE CASCADE,
  vaccine_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vaccine_notes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PRAYER LOGS
-- =============================================
CREATE TABLE public.prayer_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL,
  date DATE NOT NULL,
  prayers JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prayer_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- KIDS WORSHIP DATA
-- =============================================
CREATE TABLE public.kids_worship_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id TEXT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  day INT NOT NULL,
  items JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (child_id, year, month, day)
);
ALTER TABLE public.kids_worship_data ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TASBIH SESSIONS
-- =============================================
CREATE TABLE public.tasbih_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasbih_sessions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ISLAMIC REMINDER PREFS
-- =============================================
CREATE TABLE public.islamic_reminder_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (user_id, reminder_id)
);
ALTER TABLE public.islamic_reminder_prefs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CHAT MESSAGES (E2EE)
-- =============================================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_text TEXT NOT NULL,
  iv TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  reactions JSONB DEFAULT '{}'::jsonb,
  mention_user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- EMERGENCY CONTACTS
-- =============================================
CREATE TABLE public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRASH ITEMS
-- =============================================
CREATE TABLE public.trash_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  original_data JSONB,
  related_records JSONB,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  permanent_delete_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  restored BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.trash_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- NOTIFICATION TOKENS
-- =============================================
CREATE TABLE public.notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_info TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SCHEDULED NOTIFICATIONS
-- =============================================
CREATE TABLE public.scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- OTP CODES
-- =============================================
CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DATA EXPORT REQUESTS (PDPL)
-- =============================================
CREATE TABLE public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  file_url TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ACCOUNT DELETIONS (PDPL)
-- =============================================
CREATE TABLE public.account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_delete_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- APP VERSIONS
-- =============================================
CREATE TABLE public.app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  min_supported_version TEXT,
  force_update BOOLEAN NOT NULL DEFAULT false,
  update_message TEXT,
  release_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- UPGRADE ATTEMPTS
-- =============================================
CREATE TABLE public.upgrade_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_attempted TEXT NOT NULL,
  price NUMERIC,
  step_reached TEXT,
  abandoned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  followup_sent BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.upgrade_attempts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SUBSCRIPTION EVENTS
-- =============================================
CREATE TABLE public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  plan TEXT,
  amount NUMERIC,
  currency TEXT DEFAULT 'SAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ADMIN AUDIT LOG
-- =============================================
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FEATURE USAGE
-- =============================================
CREATE TABLE public.feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  page_path TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER SESSIONS
-- =============================================
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_info TEXT,
  platform TEXT,
  ip_address TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- NOTIFICATION LOG
-- =============================================
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by UUID REFERENCES auth.users(id),
  target_type TEXT,
  target_id TEXT,
  title TEXT NOT NULL,
  body TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_count INT NOT NULL DEFAULT 0
);
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SYSTEM SETTINGS
-- =============================================
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RATE LIMIT COUNTERS
-- =============================================
CREATE TABLE public.rate_limit_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DATA RETENTION POLICY
-- =============================================
CREATE TABLE public.data_retention_policy (
  table_name TEXT PRIMARY KEY,
  retention_days INT NOT NULL,
  auto_purge BOOLEAN NOT NULL DEFAULT false,
  description TEXT
);
ALTER TABLE public.data_retention_policy ENABLE ROW LEVEL SECURITY;
