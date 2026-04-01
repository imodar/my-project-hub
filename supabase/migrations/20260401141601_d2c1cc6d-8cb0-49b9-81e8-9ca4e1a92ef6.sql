-- إضافة عمود password_salt لجدول wills
ALTER TABLE wills ADD COLUMN IF NOT EXISTS password_salt text;

-- Performance indexes لـ get_family_last_updated
CREATE INDEX IF NOT EXISTS idx_task_lists_family_updated ON task_lists(family_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_lists_family_updated ON market_lists(family_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_family_created ON calendar_events(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_family_created ON chat_messages(family_id, created_at DESC);