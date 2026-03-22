-- =============================================
-- الدفعة 2: جداول العائلة (tables first)
-- =============================================

-- ─── families ───
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(4), 'hex'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── family_members ───
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.family_role NOT NULL DEFAULT 'son',
  is_admin boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);

-- ─── family_invites ───
CREATE TABLE public.family_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_type text NOT NULL DEFAULT 'code',
  role_assigned public.family_role,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_by uuid REFERENCES auth.users(id),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── family_keys (E2EE) ───
CREATE TABLE public.family_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);

-- ─── family_deletions ───
CREATE TABLE public.family_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  deleted_by uuid NOT NULL REFERENCES auth.users(id),
  reason text,
  status text NOT NULL DEFAULT 'pending',
  deleted_at timestamptz NOT NULL DEFAULT now(),
  permanent_delete_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  restored_at timestamptz
);

-- ─── member_removals ───
CREATE TABLE public.member_removals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  removed_user_id uuid NOT NULL REFERENCES auth.users(id),
  removed_by uuid NOT NULL REFERENCES auth.users(id),
  reason text,
  personal_data_migrated boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  permanent_delete_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  restored_at timestamptz
);

-- ─── admin_transfer_requests ───
CREATE TABLE public.admin_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  reason text,
  approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_approvals int NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Now create security functions ───
CREATE OR REPLACE FUNCTION public.is_family_member(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND family_id = _family_id AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_family_admin(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND family_id = _family_id AND is_admin = true AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_family_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.family_members
  WHERE user_id = _user_id AND status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_staff_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND role IN ('worker', 'maid', 'driver') AND status = 'active'
  )
$$;

-- ─── Enable RLS on all tables ───
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_removals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_transfer_requests ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ───
CREATE POLICY "Members can view their family" ON public.families
  FOR SELECT TO authenticated USING (public.is_family_member(auth.uid(), id));
CREATE POLICY "Authenticated can create family" ON public.families
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update family" ON public.families
  FOR UPDATE TO authenticated USING (public.is_family_admin(auth.uid(), id));

CREATE POLICY "Members can view family members" ON public.family_members
  FOR SELECT TO authenticated USING (public.is_family_member(auth.uid(), family_id) OR user_id = auth.uid());
CREATE POLICY "Admins can manage members" ON public.family_members
  FOR ALL TO authenticated USING (public.is_family_admin(auth.uid(), family_id));
CREATE POLICY "Users can insert themselves" ON public.family_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage invites" ON public.family_invites
  FOR ALL TO authenticated USING (public.is_family_admin(auth.uid(), family_id));
CREATE POLICY "Anyone can read valid invites" ON public.family_invites
  FOR SELECT TO authenticated USING (expires_at > now() AND used_by IS NULL);

CREATE POLICY "Users can view own family key" ON public.family_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage family keys" ON public.family_keys
  FOR ALL TO authenticated USING (public.is_family_admin(auth.uid(), family_id));

CREATE POLICY "Admins can manage family deletions" ON public.family_deletions
  FOR ALL TO authenticated USING (public.is_family_admin(auth.uid(), family_id));

CREATE POLICY "Admins can manage member removals" ON public.member_removals
  FOR ALL TO authenticated USING (public.is_family_admin(auth.uid(), family_id));
CREATE POLICY "Removed users can view own removal" ON public.member_removals
  FOR SELECT TO authenticated USING (auth.uid() = removed_user_id);

CREATE POLICY "Family members can view transfer requests" ON public.admin_transfer_requests
  FOR SELECT TO authenticated USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "Members can create transfer requests" ON public.admin_transfer_requests
  FOR INSERT TO authenticated WITH CHECK (public.is_family_member(auth.uid(), family_id));