
-- =============================================
-- ENUM TYPES
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- =============================================
-- PROFILES
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  avatar_url TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER ROLES
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER KEYPAIRS (E2EE)
-- =============================================
CREATE TABLE public.user_keypairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_keypairs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CONSENT LOG
-- =============================================
CREATE TABLE public.consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT true,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FAMILIES
-- =============================================
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FAMILY MEMBERS
-- =============================================
CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'son',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FAMILY INVITES
-- =============================================
CREATE TABLE public.family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_type TEXT NOT NULL DEFAULT 'code',
  role_assigned TEXT,
  expires_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FAMILY KEYS (E2EE)
-- =============================================
CREATE TABLE public.family_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
ALTER TABLE public.family_keys ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FAMILY DELETIONS
-- =============================================
CREATE TABLE public.family_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  deleted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  permanent_delete_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  restored_at TIMESTAMPTZ
);
ALTER TABLE public.family_deletions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- MEMBER REMOVALS
-- =============================================
CREATE TABLE public.member_removals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  removed_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  removed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  personal_data_migrated BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  permanent_delete_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  restored_at TIMESTAMPTZ
);
ALTER TABLE public.member_removals ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ADMIN TRANSFER REQUESTS
-- =============================================
CREATE TABLE public.admin_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_approvals INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_transfer_requests ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.phone,
    now(),
    now()
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
