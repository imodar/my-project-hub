CREATE TABLE public.otp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  action text NOT NULL, -- 'send' or 'verify'
  success boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view OTP audit log"
  ON public.otp_audit_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "No client insert"
  ON public.otp_audit_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE INDEX idx_otp_audit_log_phone ON public.otp_audit_log (phone);
CREATE INDEX idx_otp_audit_log_created_at ON public.otp_audit_log (created_at DESC);