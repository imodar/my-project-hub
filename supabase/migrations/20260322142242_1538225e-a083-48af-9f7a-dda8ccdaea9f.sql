
-- =============================================
-- MARKET LISTS
-- =============================================
CREATE TABLE public.market_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'family',
  shared_with UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.market_lists ENABLE ROW LEVEL SECURITY;

-- =============================================
-- MARKET ITEMS
-- =============================================
CREATE TABLE public.market_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.market_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  quantity TEXT,
  added_by UUID REFERENCES auth.users(id),
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.market_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- BUDGETS
-- =============================================
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'month',
  month TEXT,
  label TEXT,
  income NUMERIC DEFAULT 0,
  trip_id UUID,
  shared_with UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- =============================================
-- BUDGET EXPENSES
-- =============================================
CREATE TABLE public.budget_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.budget_expenses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TASK LISTS
-- =============================================
CREATE TABLE public.task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'family',
  shared_with UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TASK ITEMS
-- =============================================
CREATE TABLE public.task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.task_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT,
  priority TEXT NOT NULL DEFAULT 'none',
  assigned_to UUID REFERENCES auth.users(id),
  done BOOLEAN NOT NULL DEFAULT false,
  repeat_enabled BOOLEAN NOT NULL DEFAULT false,
  repeat_days INT[] DEFAULT '{}',
  repeat_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CALENDAR EVENTS
-- =============================================
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  icon TEXT,
  reminder_before TEXT[] DEFAULT '{}',
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personal_reminders TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DEBTS
-- =============================================
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  person_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  payment_details JSONB,
  date TEXT,
  due_date TEXT,
  note TEXT,
  is_fully_paid BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  has_reminder BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DEBT PAYMENTS
-- =============================================
CREATE TABLE public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  payment_details JSONB,
  date TEXT,
  type TEXT,
  item_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DEBT POSTPONEMENTS
-- =============================================
CREATE TABLE public.debt_postponements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  new_date TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.debt_postponements ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIPS
-- =============================================
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination TEXT,
  start_date TEXT,
  end_date TEXT,
  budget NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planning',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIP DAY PLANS
-- =============================================
CREATE TABLE public.trip_day_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  city TEXT
);
ALTER TABLE public.trip_day_plans ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIP ACTIVITIES
-- =============================================
CREATE TABLE public.trip_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_plan_id UUID NOT NULL REFERENCES public.trip_day_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  time TEXT,
  location TEXT,
  cost NUMERIC DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.trip_activities ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIP SUGGESTIONS
-- =============================================
CREATE TABLE public.trip_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  place_name TEXT NOT NULL,
  type TEXT,
  reason TEXT,
  location TEXT,
  suggested_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending'
);
ALTER TABLE public.trip_suggestions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIP PACKING
-- =============================================
CREATE TABLE public.trip_packing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  packed BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.trip_packing ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIP EXPENSES
-- =============================================
CREATE TABLE public.trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0
);
ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIP DOCUMENTS
-- =============================================
CREATE TABLE public.trip_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  file_url TEXT,
  file_name TEXT,
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DOCUMENT LISTS
-- =============================================
CREATE TABLE public.document_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'family',
  shared_with UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.document_lists ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DOCUMENT ITEMS
-- =============================================
CREATE TABLE public.document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.document_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  expiry_date TEXT,
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.document_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DOCUMENT FILES
-- =============================================
CREATE TABLE public.document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.document_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  file_url TEXT,
  size INT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PLACE LISTS
-- =============================================
CREATE TABLE public.place_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'family',
  shared_with UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.place_lists ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PLACES
-- =============================================
CREATE TABLE public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.place_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  address TEXT,
  social_link TEXT,
  phone TEXT,
  price_range TEXT,
  rating NUMERIC,
  kid_friendly TEXT,
  added_by UUID REFERENCES auth.users(id),
  suggested_by UUID REFERENCES auth.users(id),
  visited BOOLEAN NOT NULL DEFAULT false,
  must_visit BOOLEAN NOT NULL DEFAULT false,
  note TEXT
);
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ALBUMS
-- =============================================
CREATE TABLE public.albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cover_color TEXT,
  linked_trip_id UUID REFERENCES public.trips(id),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ALBUM PHOTOS
-- =============================================
CREATE TABLE public.album_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  date TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.album_photos ENABLE ROW LEVEL SECURITY;

-- Add updated_at triggers
CREATE TRIGGER market_lists_updated_at BEFORE UPDATE ON public.market_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER task_lists_updated_at BEFORE UPDATE ON public.task_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER document_lists_updated_at BEFORE UPDATE ON public.document_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER place_lists_updated_at BEFORE UPDATE ON public.place_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add trip_id FK to budgets
ALTER TABLE public.budgets ADD CONSTRAINT budgets_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;
