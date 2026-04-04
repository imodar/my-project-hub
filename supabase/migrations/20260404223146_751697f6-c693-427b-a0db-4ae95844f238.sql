CREATE OR REPLACE FUNCTION public.find_user_by_phone_or_email(_phone text, _email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT id FROM auth.users
  WHERE phone = _phone OR email = _email
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_phone_or_email FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_by_phone_or_email TO service_role;