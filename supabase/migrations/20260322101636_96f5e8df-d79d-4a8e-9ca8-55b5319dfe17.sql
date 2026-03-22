-- =============================================
-- الدفعة 3ب: رحلات، وثائق، أماكن، ألبومات، زكاة، وصية
-- =============================================

-- ─── trips ───
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL,
  destination text,
  start_date date,
  end_date date,
  budget numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planning',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can access trips" ON public.trips
  FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid()));

CREATE TABLE public.trip_day_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  city text
);
ALTER TABLE public.trip_day_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent trip" ON public.trip_day_plans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND public.is_family_member(auth.uid(), t.family_id)));

CREATE TABLE public.trip_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_plan_id uuid NOT NULL REFERENCES public.trip_day_plans(id) ON DELETE CASCADE,
  name text NOT NULL, time text, location text, cost numeric DEFAULT 0, completed boolean DEFAULT false
);
ALTER TABLE public.trip_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent day plan" ON public.trip_activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip_day_plans dp JOIN public.trips t ON t.id = dp.trip_id WHERE dp.id = day_plan_id AND public.is_family_member(auth.uid(), t.family_id)));

CREATE TABLE public.trip_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  place_name text NOT NULL, type text, reason text, location text,
  suggested_by uuid REFERENCES auth.users(id), status text DEFAULT 'pending'
);
ALTER TABLE public.trip_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent trip" ON public.trip_suggestions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND public.is_family_member(auth.uid(), t.family_id)));

CREATE TABLE public.trip_packing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name text NOT NULL, packed boolean DEFAULT false
);
ALTER TABLE public.trip_packing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent trip" ON public.trip_packing FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND public.is_family_member(auth.uid(), t.family_id)));

CREATE TABLE public.trip_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name text NOT NULL, amount numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent trip" ON public.trip_expenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND public.is_family_member(auth.uid(), t.family_id)));

CREATE TABLE public.trip_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name text NOT NULL, type text, file_url text, file_name text, notes text,
  added_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent trip" ON public.trip_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND public.is_family_member(auth.uid(), t.family_id)));

-- ─── document_lists ───
CREATE TABLE public.document_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL, type text DEFAULT 'personal',
  shared_with uuid[] DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Non-staff can access document lists" ON public.document_lists
  FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid()));
CREATE TRIGGER update_document_lists_updated_at BEFORE UPDATE ON public.document_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.document_lists(id) ON DELETE CASCADE,
  name text NOT NULL, category text, expiry_date date, reminder_enabled boolean DEFAULT false,
  note text, added_by uuid REFERENCES auth.users(id), added_at timestamptz DEFAULT now()
);
ALTER TABLE public.document_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent list" ON public.document_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.document_lists dl WHERE dl.id = list_id AND public.is_family_member(auth.uid(), dl.family_id) AND NOT public.is_staff_member(auth.uid())));

CREATE TABLE public.document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.document_items(id) ON DELETE CASCADE,
  name text NOT NULL, type text, file_url text NOT NULL, size bigint,
  added_at timestamptz DEFAULT now()
);
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent document" ON public.document_files FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.document_items di JOIN public.document_lists dl ON dl.id = di.list_id WHERE di.id = document_id AND public.is_family_member(auth.uid(), dl.family_id)));

-- ─── place_lists ───
CREATE TABLE public.place_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL, type text DEFAULT 'personal',
  shared_with uuid[] DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.place_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Non-staff can access place lists" ON public.place_lists
  FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid()));
CREATE TRIGGER update_place_lists_updated_at BEFORE UPDATE ON public.place_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.place_lists(id) ON DELETE CASCADE,
  name text NOT NULL, category text, description text,
  lat double precision, lng double precision, address text,
  social_link text, phone text, price_range text, rating numeric,
  kid_friendly boolean DEFAULT false,
  added_by uuid REFERENCES auth.users(id), suggested_by uuid REFERENCES auth.users(id),
  visited boolean DEFAULT false, must_visit boolean DEFAULT false, note text
);
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent list" ON public.places FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.place_lists pl WHERE pl.id = list_id AND public.is_family_member(auth.uid(), pl.family_id) AND NOT public.is_staff_member(auth.uid())));

-- ─── albums ───
CREATE TABLE public.albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL, cover_color text,
  linked_trip_id uuid REFERENCES public.trips(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Non-staff can access albums" ON public.albums
  FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid()));

CREATE TABLE public.album_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  url text NOT NULL, date date, caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.album_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent album" ON public.album_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND public.is_family_member(auth.uid(), a.family_id) AND NOT public.is_staff_member(auth.uid())));

-- ─── zakat_assets ───
CREATE TABLE public.zakat_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0, currency text DEFAULT 'SAR',
  weight_grams numeric, purchase_date date,
  reminder boolean DEFAULT false, zakat_paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zakat_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own zakat" ON public.zakat_assets
  FOR ALL TO authenticated USING (auth.uid() = user_id AND NOT public.is_staff_member(auth.uid()));

CREATE TABLE public.zakat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.zakat_assets(id) ON DELETE CASCADE,
  amount_paid numeric NOT NULL, paid_at timestamptz NOT NULL DEFAULT now(), notes text
);
ALTER TABLE public.zakat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent asset" ON public.zakat_history FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.zakat_assets za WHERE za.id = asset_id AND za.user_id = auth.uid()));

-- ─── wills (E2EE) ───
CREATE TABLE public.wills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  password_hash text,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own will" ON public.wills
  FOR ALL TO authenticated USING (auth.uid() = user_id AND NOT public.is_staff_member(auth.uid()));
CREATE TRIGGER update_wills_updated_at BEFORE UPDATE ON public.wills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.will_open_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  will_id uuid NOT NULL REFERENCES public.wills(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  reason text, status text DEFAULT 'pending',
  approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_approvals int NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.will_open_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can view will requests" ON public.will_open_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wills w JOIN public.family_members fm ON fm.user_id = w.user_id WHERE w.id = will_id AND public.is_family_member(auth.uid(), fm.family_id)));
CREATE POLICY "Family members can create will requests" ON public.will_open_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);