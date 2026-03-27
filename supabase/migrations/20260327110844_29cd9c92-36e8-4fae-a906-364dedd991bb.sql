CREATE OR REPLACE FUNCTION public.get_family_last_updated(_family_id uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT GREATEST(
    (SELECT MAX(updated_at) FROM task_lists WHERE family_id = _family_id),
    (SELECT MAX(updated_at) FROM market_lists WHERE family_id = _family_id),
    (SELECT MAX(created_at) FROM calendar_events WHERE family_id = _family_id),
    (SELECT MAX(created_at) FROM chat_messages WHERE family_id = _family_id)
  );
$$;