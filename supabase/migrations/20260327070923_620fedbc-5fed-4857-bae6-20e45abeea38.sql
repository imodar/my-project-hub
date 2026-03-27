-- Schedule cleanup of old rate limit counters every 6 hours
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 */6 * * *',
  $$DELETE FROM public.rate_limit_counters WHERE window_start < now() - interval '24 hours'$$
);