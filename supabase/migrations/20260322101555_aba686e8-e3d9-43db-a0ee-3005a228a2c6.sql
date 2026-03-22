-- =============================================
-- الدفعة 3أ: تسوق، ميزانية، مهام، تقويم، ديون
-- =============================================

-- ─── market_lists ───
CREATE TABLE public.market_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'personal',
  shared_with uuid[] DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can view market lists" ON public.market_lists
  FOR SELECT TO authenticated USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "Family members can create market lists" ON public.market_lists
  FOR INSERT TO authenticated WITH CHECK (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "Owner or admin can update market lists" ON public.market_lists
  FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_family_admin(auth.uid(), family_id));
CREATE POLICY "Owner or admin can delete market lists" ON public.market_lists
  FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_family_admin(auth.uid(), family_id));
CREATE TRIGGER update_market_lists_updated_at BEFORE UPDATE ON public.market_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── market_items ───
CREATE TABLE public.market_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.market_lists(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  quantity int NOT NULL DEFAULT 1,
  added_by uuid REFERENCES auth.users(id),
  checked boolean NOT NULL DEFAULT false,
  checked_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent list" ON public.market_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.market_lists ml WHERE ml.id = list_id AND public.is_family_member(auth.uid(), ml.family_id)));

-- ─── budgets ───
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'month',
  month text,
  label text,
  income numeric NOT NULL DEFAULT 0,
  trip_id uuid,
  shared_with uuid[] DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Non-staff family members can access budgets" ON public.budgets
  FOR ALL TO authenticated
  USING (public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid()));
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── budget_expenses ───
CREATE TABLE public.budget_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.budget_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent budget" ON public.budget_expenses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND public.is_family_member(auth.uid(), b.family_id) AND NOT public.is_staff_member(auth.uid())));

-- ─── task_lists ───
CREATE TABLE public.task_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'personal',
  shared_with uuid[] DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can view task lists" ON public.task_lists
  FOR SELECT TO authenticated USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "Family members can create task lists" ON public.task_lists
  FOR INSERT TO authenticated WITH CHECK (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "Owner or admin can update task lists" ON public.task_lists
  FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_family_admin(auth.uid(), family_id));
CREATE POLICY "Owner or admin can delete task lists" ON public.task_lists
  FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_family_admin(auth.uid(), family_id));
CREATE TRIGGER update_task_lists_updated_at BEFORE UPDATE ON public.task_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── task_items ───
CREATE TABLE public.task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.task_lists(id) ON DELETE CASCADE,
  name text NOT NULL,
  note text,
  priority text DEFAULT 'medium',
  assigned_to uuid REFERENCES auth.users(id),
  done boolean NOT NULL DEFAULT false,
  repeat_enabled boolean NOT NULL DEFAULT false,
  repeat_days int[] DEFAULT '{}',
  repeat_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent task list" ON public.task_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.task_lists tl WHERE tl.id = list_id AND public.is_family_member(auth.uid(), tl.family_id)));

-- ─── calendar_events ───
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  title text NOT NULL,
  date date NOT NULL,
  icon text,
  reminder_before text[] DEFAULT '{}',
  added_by uuid NOT NULL REFERENCES auth.users(id),
  personal_reminders text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Non-staff can access calendar" ON public.calendar_events
  FOR ALL TO authenticated
  USING (public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid()));

-- ─── debts ───
CREATE TABLE public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  direction text NOT NULL,
  person_name text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  payment_details jsonb,
  date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  note text,
  is_fully_paid boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  has_reminder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own debts" ON public.debts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_staff_member(auth.uid()));

-- ─── debt_payments ───
CREATE TABLE public.debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  payment_details jsonb,
  date date NOT NULL DEFAULT CURRENT_DATE,
  type text,
  item_description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent debt" ON public.debt_payments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.debts d WHERE d.id = debt_id AND d.user_id = auth.uid()));

-- ─── debt_postponements ───
CREATE TABLE public.debt_postponements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  new_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.debt_postponements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent debt" ON public.debt_postponements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.debts d WHERE d.id = debt_id AND d.user_id = auth.uid()));