-- Fix permissive RLS on prayer_logs and kids_worship_data
DROP POLICY "Authenticated can access prayer logs" ON public.prayer_logs;
DROP POLICY "Authenticated can access worship data" ON public.kids_worship_data;

-- prayer_logs: link via family through vaccination_children or direct family check
-- For now, scope to family members via a user_id column
ALTER TABLE public.prayer_logs ADD COLUMN user_id uuid REFERENCES auth.users(id);

CREATE POLICY "Users can manage own prayer logs" ON public.prayer_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert prayer logs" ON public.prayer_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- kids_worship_data: add user_id for scoping
ALTER TABLE public.kids_worship_data ADD COLUMN user_id uuid REFERENCES auth.users(id);

CREATE POLICY "Users can manage own worship data" ON public.kids_worship_data
  FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert worship data" ON public.kids_worship_data
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);