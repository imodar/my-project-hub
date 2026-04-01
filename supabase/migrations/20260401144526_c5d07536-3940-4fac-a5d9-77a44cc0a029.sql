CREATE POLICY "No client access" ON otp_codes 
  FOR ALL TO authenticated, anon USING (false);