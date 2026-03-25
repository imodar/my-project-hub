
CREATE TABLE public.member_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  family_id uuid NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_sharing boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, family_id)
);

ALTER TABLE public.member_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view locations"
  ON public.member_locations
  FOR SELECT
  TO authenticated
  USING (is_family_member(auth.uid(), family_id));

CREATE POLICY "Users can upsert own location"
  ON public.member_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own location"
  ON public.member_locations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
