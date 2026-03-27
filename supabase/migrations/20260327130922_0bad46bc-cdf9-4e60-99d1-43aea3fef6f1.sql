-- إضافة فهارس مركبة لدعم Delta Sync والأداء عند 100K+ سجل

-- task_items: فهرس على list_id + created_at للاستعلامات المرتبة
CREATE INDEX IF NOT EXISTS idx_task_items_list_created ON public.task_items (list_id, created_at DESC);

-- market_items: فهرس على list_id + created_at
CREATE INDEX IF NOT EXISTS idx_market_items_list_created ON public.market_items (list_id, created_at DESC);

-- album_photos: فهرس على album_id + created_at
CREATE INDEX IF NOT EXISTS idx_album_photos_album_created ON public.album_photos (album_id, created_at DESC);

-- task_lists: فهرس على family_id + updated_at لدعم delta sync
CREATE INDEX IF NOT EXISTS idx_task_lists_family_updated ON public.task_lists (family_id, updated_at DESC);

-- market_lists: فهرس على family_id + updated_at لدعم delta sync
CREATE INDEX IF NOT EXISTS idx_market_lists_family_updated ON public.market_lists (family_id, updated_at DESC);

-- albums: فهرس على family_id + created_at لدعم delta sync
CREATE INDEX IF NOT EXISTS idx_albums_family_created ON public.albums (family_id, created_at DESC);

-- debts: فهرس مركب على user_id + is_fully_paid للاستعلامات المتكررة
CREATE INDEX IF NOT EXISTS idx_debts_user_paid ON public.debts (user_id, is_fully_paid) WHERE is_fully_paid = false;

-- medication_logs: فهرس على medication_id + taken_at للأداء
CREATE INDEX IF NOT EXISTS idx_medication_logs_med_taken ON public.medication_logs (medication_id, taken_at DESC);

-- places: فهرس على list_id
CREATE INDEX IF NOT EXISTS idx_places_list ON public.places (list_id);

-- trip_day_plans: فهرس على trip_id
CREATE INDEX IF NOT EXISTS idx_trip_day_plans_trip ON public.trip_day_plans (trip_id, day_number);

-- trip_activities: فهرس على day_plan_id
CREATE INDEX IF NOT EXISTS idx_trip_activities_day_plan ON public.trip_activities (day_plan_id);

-- user_notifications: فهرس على user_id + is_read للتنبيهات غير المقروءة
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread ON public.user_notifications (user_id, created_at DESC) WHERE is_read = false;