
-- إضافة عمود user_id لـ kids_worship_data
ALTER TABLE kids_worship_data ADD COLUMN IF NOT EXISTS user_id uuid;

-- حذف السياسات القديمة لـ prayer_logs
DROP POLICY IF EXISTS "Authenticated access prayer logs" ON prayer_logs;
DROP POLICY IF EXISTS "Authenticated delete prayer logs" ON prayer_logs;
DROP POLICY IF EXISTS "Authenticated insert prayer logs" ON prayer_logs;
DROP POLICY IF EXISTS "Authenticated update prayer logs" ON prayer_logs;

-- سياسة جديدة: الوصول فقط لأفراد العائلة عبر worship_children
CREATE POLICY "Family access prayer logs" ON prayer_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM worship_children wc
      WHERE wc.id = prayer_logs.child_id
      AND is_family_member(auth.uid(), wc.family_id)
    )
  );

-- حذف السياسات القديمة لـ kids_worship_data
DROP POLICY IF EXISTS "Authenticated access kids worship" ON kids_worship_data;
DROP POLICY IF EXISTS "Authenticated delete kids worship" ON kids_worship_data;
DROP POLICY IF EXISTS "Authenticated insert kids worship" ON kids_worship_data;
DROP POLICY IF EXISTS "Authenticated update kids worship" ON kids_worship_data;

-- سياسة جديدة: المستخدم يصل لبياناته فقط
CREATE POLICY "Users access own worship data" ON kids_worship_data
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
