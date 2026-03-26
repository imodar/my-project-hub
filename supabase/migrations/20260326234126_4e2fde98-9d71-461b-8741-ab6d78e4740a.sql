CREATE TABLE worship_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE worship_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members access worship children"
  ON worship_children FOR ALL TO authenticated
  USING (is_family_member(auth.uid(), family_id));

CREATE INDEX idx_worship_children_family ON worship_children(family_id);