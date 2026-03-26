
-- Performance Indexes for all heavily-queried tables

-- RLS hot-path: family_members (called on EVERY request)
CREATE INDEX IF NOT EXISTS idx_family_members_user_status ON public.family_members (user_id, status);
CREATE INDEX IF NOT EXISTS idx_family_members_family_status ON public.family_members (family_id, status);
CREATE INDEX IF NOT EXISTS idx_family_members_family_admin ON public.family_members (family_id, is_admin) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_family_members_role ON public.family_members (user_id, role) WHERE status = 'active';

-- user_roles (has_role called in every admin check)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles (user_id, role);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_not_deleted ON public.profiles (is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON public.profiles (last_login_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON public.profiles (subscription_plan) WHERE is_deleted = false;

-- chat_messages (high volume, paginated)
CREATE INDEX IF NOT EXISTS idx_chat_messages_family_created ON public.chat_messages (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_pinned ON public.chat_messages (family_id) WHERE pinned = true;

-- calendar_events
CREATE INDEX IF NOT EXISTS idx_calendar_events_family_date ON public.calendar_events (family_id, date DESC);

-- task_items
CREATE INDEX IF NOT EXISTS idx_task_items_list ON public.task_items (list_id);
CREATE INDEX IF NOT EXISTS idx_task_items_done ON public.task_items (list_id, done);

-- task_lists
CREATE INDEX IF NOT EXISTS idx_task_lists_family ON public.task_lists (family_id);

-- market_items
CREATE INDEX IF NOT EXISTS idx_market_items_list ON public.market_items (list_id);

-- market_lists
CREATE INDEX IF NOT EXISTS idx_market_lists_family ON public.market_lists (family_id);

-- debts
CREATE INDEX IF NOT EXISTS idx_debts_user ON public.debts (user_id);
CREATE INDEX IF NOT EXISTS idx_debts_family ON public.debts (family_id);
CREATE INDEX IF NOT EXISTS idx_debts_unpaid ON public.debts (user_id) WHERE is_fully_paid = false;

-- debt_payments
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON public.debt_payments (debt_id);

-- medications
CREATE INDEX IF NOT EXISTS idx_medications_family ON public.medications (family_id);

-- medication_logs
CREATE INDEX IF NOT EXISTS idx_medication_logs_med ON public.medication_logs (medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_taken ON public.medication_logs (medication_id, taken_at DESC);

-- document_items
CREATE INDEX IF NOT EXISTS idx_document_items_list ON public.document_items (list_id);
CREATE INDEX IF NOT EXISTS idx_document_items_expiry ON public.document_items (expiry_date) WHERE expiry_date IS NOT NULL;

-- document_lists
CREATE INDEX IF NOT EXISTS idx_document_lists_family ON public.document_lists (family_id);

-- document_files
CREATE INDEX IF NOT EXISTS idx_document_files_doc ON public.document_files (document_id);

-- places
CREATE INDEX IF NOT EXISTS idx_places_list ON public.places (list_id);

-- place_lists
CREATE INDEX IF NOT EXISTS idx_place_lists_family ON public.place_lists (family_id);

-- albums
CREATE INDEX IF NOT EXISTS idx_albums_family ON public.albums (family_id);

-- album_photos
CREATE INDEX IF NOT EXISTS idx_album_photos_album ON public.album_photos (album_id);

-- budgets
CREATE INDEX IF NOT EXISTS idx_budgets_family ON public.budgets (family_id);

-- budget_expenses
CREATE INDEX IF NOT EXISTS idx_budget_expenses_budget ON public.budget_expenses (budget_id);

-- trips
CREATE INDEX IF NOT EXISTS idx_trips_family ON public.trips (family_id);

-- trip_day_plans
CREATE INDEX IF NOT EXISTS idx_trip_day_plans_trip ON public.trip_day_plans (trip_id);

-- trip_activities
CREATE INDEX IF NOT EXISTS idx_trip_activities_day ON public.trip_activities (day_plan_id);

-- trip_documents
CREATE INDEX IF NOT EXISTS idx_trip_documents_trip ON public.trip_documents (trip_id);

-- trip_expenses
CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip ON public.trip_expenses (trip_id);

-- trip_packing
CREATE INDEX IF NOT EXISTS idx_trip_packing_trip ON public.trip_packing (trip_id);

-- trip_suggestions
CREATE INDEX IF NOT EXISTS idx_trip_suggestions_trip ON public.trip_suggestions (trip_id);

-- user_notifications
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON public.user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications (user_id) WHERE is_read = false;

-- notification_tokens
CREATE INDEX IF NOT EXISTS idx_notification_tokens_user ON public.notification_tokens (user_id);

-- trash_items
CREATE INDEX IF NOT EXISTS idx_trash_items_user ON public.trash_items (user_id);
CREATE INDEX IF NOT EXISTS idx_trash_items_family ON public.trash_items (family_id) WHERE family_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_items_cleanup ON public.trash_items (permanent_delete_at) WHERE restored = false;

-- rate_limit_counters
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_endpoint ON public.rate_limit_counters (user_id, endpoint);

-- feature_usage
CREATE INDEX IF NOT EXISTS idx_feature_usage_created ON public.feature_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_usage_name ON public.feature_usage (feature_name, created_at DESC);

-- otp_codes
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON public.otp_codes (phone, created_at DESC);

-- member_locations
CREATE INDEX IF NOT EXISTS idx_member_locations_family ON public.member_locations (family_id);
CREATE INDEX IF NOT EXISTS idx_member_locations_user ON public.member_locations (user_id);

-- family_keys
CREATE INDEX IF NOT EXISTS idx_family_keys_user ON public.family_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_family_keys_family ON public.family_keys (family_id);

-- consent_log
CREATE INDEX IF NOT EXISTS idx_consent_log_user ON public.consent_log (user_id);

-- admin_audit_log
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log (created_at DESC);

-- scheduled_notifications
CREATE INDEX IF NOT EXISTS idx_scheduled_notif_pending ON public.scheduled_notifications (scheduled_at) WHERE sent = false;
CREATE INDEX IF NOT EXISTS idx_scheduled_notif_user ON public.scheduled_notifications (user_id);

-- kids_worship_data
CREATE INDEX IF NOT EXISTS idx_kids_worship_child ON public.kids_worship_data (child_id, year, month);

-- prayer_logs
CREATE INDEX IF NOT EXISTS idx_prayer_logs_child_date ON public.prayer_logs (child_id, date DESC);

-- islamic_reminder_prefs
CREATE INDEX IF NOT EXISTS idx_islamic_reminder_user ON public.islamic_reminder_prefs (user_id);

-- tasbih_sessions
CREATE INDEX IF NOT EXISTS idx_tasbih_user ON public.tasbih_sessions (user_id, created_at DESC);

-- account_deletions
CREATE INDEX IF NOT EXISTS idx_account_deletions_pending ON public.account_deletions (status) WHERE status = 'pending';

-- subscription_events
CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON public.subscription_events (user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created ON public.subscription_events (created_at DESC);
