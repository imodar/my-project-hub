-- =============================================
-- الدفعة 3ج: مركبات، صحة، عبادة، دردشة
-- =============================================

-- ─── vehicles ───
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  manufacturer text, model text, year int, mileage numeric DEFAULT 0,
  mileage_unit text DEFAULT 'km', color text, plate_number text,
  shared_with uuid[] DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can access vehicles" ON public.vehicles
  FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id));

CREATE TABLE public.vehicle_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type text NOT NULL, label text, date date,
  mileage_at_service numeric, next_mileage numeric, next_date date, notes text
);
ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent vehicle" ON public.vehicle_maintenance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.is_family_member(auth.uid(), v.family_id)));

-- ─── medications ───
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL, dosage text,
  member_id uuid REFERENCES auth.users(id), member_name text,
  frequency_type text, frequency_value int, selected_days int[],
  times_per_day int DEFAULT 1, specific_times text[],
  start_date date, end_date date, notes text, color text,
  reminder_enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can access medications" ON public.medications
  FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id));

CREATE TABLE public.medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  taken_by uuid REFERENCES auth.users(id),
  skipped boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent medication" ON public.medication_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.medications m WHERE m.id = medication_id AND public.is_family_member(auth.uid(), m.family_id)));

-- ─── vaccination_children ───
CREATE TABLE public.vaccination_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL, gender text, birth_date date,
  completed_vaccines jsonb DEFAULT '[]'::jsonb,
  reminder_settings jsonb DEFAULT '{"before_day": true, "before_week": true, "before_month": true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vaccination_children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can access vaccinations" ON public.vaccination_children
  FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid()));

CREATE TABLE public.vaccine_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.vaccination_children(id) ON DELETE CASCADE,
  vaccine_id text NOT NULL, note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vaccine_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent child" ON public.vaccine_notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vaccination_children vc WHERE vc.id = child_id AND public.is_family_member(auth.uid(), vc.family_id)));

-- ─── prayer_logs ───
CREATE TABLE public.prayer_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  date date NOT NULL, prayers jsonb DEFAULT '{}'::jsonb, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prayer_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can access prayer logs" ON public.prayer_logs
  FOR ALL TO authenticated USING (true);

-- ─── kids_worship_data ───
CREATE TABLE public.kids_worship_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id text NOT NULL, year int NOT NULL, month int NOT NULL,
  day int NOT NULL, items jsonb DEFAULT '{}'::jsonb,
  UNIQUE (child_id, year, month, day)
);
ALTER TABLE public.kids_worship_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can access worship data" ON public.kids_worship_data
  FOR ALL TO authenticated USING (true);

-- ─── tasbih_sessions ───
CREATE TABLE public.tasbih_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasbih_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasbih" ON public.tasbih_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ─── islamic_reminder_prefs ───
CREATE TABLE public.islamic_reminder_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, reminder_id)
);
ALTER TABLE public.islamic_reminder_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reminder prefs" ON public.islamic_reminder_prefs
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ─── chat_messages (E2EE) ───
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  encrypted_text text NOT NULL,
  iv text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  reactions jsonb DEFAULT '{}'::jsonb,
  mention_user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can access chat" ON public.chat_messages
  FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id));

-- ─── emergency_contacts ───
CREATE TABLE public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL, phone text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id)
);
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can access emergency contacts" ON public.emergency_contacts
  FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id));