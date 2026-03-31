-- Fix: Block direct INSERT on family_members — all joins must go through family-management edge function (service role)
DROP POLICY IF EXISTS "Users can join family" ON public.family_members;

CREATE POLICY "Block direct family joins"
  ON public.family_members
  FOR INSERT
  TO authenticated
  WITH CHECK (false);