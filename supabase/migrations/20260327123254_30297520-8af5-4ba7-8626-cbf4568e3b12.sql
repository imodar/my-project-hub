-- Remove duplicates before adding UNIQUE constraint
DELETE FROM rate_limit_counters a
USING rate_limit_counters b
WHERE a.id > b.id 
  AND a.user_id = b.user_id 
  AND a.endpoint = b.endpoint;

-- Add UNIQUE constraint
ALTER TABLE rate_limit_counters 
ADD CONSTRAINT rate_limit_unique UNIQUE (user_id, endpoint);

-- Create atomic rate limit function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid, _endpoint text, _max_per_minute int DEFAULT 60
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count int;
BEGIN
  INSERT INTO rate_limit_counters (user_id, endpoint, count, window_start)
  VALUES (_user_id, _endpoint, 1, now())
  ON CONFLICT (user_id, endpoint) DO UPDATE SET
    count = CASE WHEN rate_limit_counters.window_start > now() - interval '1 minute'
      THEN rate_limit_counters.count + 1 ELSE 1 END,
    window_start = CASE WHEN rate_limit_counters.window_start > now() - interval '1 minute'
      THEN rate_limit_counters.window_start ELSE now() END
  RETURNING count INTO _count;
  RETURN _count <= _max_per_minute;
END; $$;