
# خطة إصلاح المشاكل الحرجة والأداء والاستقرار — مُنفَّذة ✅

## ما تم تنفيذه

### 1. ✅ Rate Limit — DB Function ذرية + UNIQUE constraint
- Migration: حذف duplicates + UNIQUE(user_id, endpoint) + دالة `check_rate_limit` ذرية
- تحديث 29 Edge Function لاستخدام `adminClient.rpc("check_rate_limit", ...)`

### 2. ✅ CORS — تقييد Origins عبر env variable
- إضافة `ALLOWED_ORIGINS` secret
- تحديث 29 Edge Function بـ `getCorsHeaders(req)` مع fallback آمن `""`

### 3. ✅ warmCache — إضافة trip_suggestions

### 4. ✅ useInitialSync — إصلاح منطق "حساب جديد"
- استبدال فحص الدقيقتين بفحص السحاب عبر get-last-updated
- null = حساب جديد، timestamp = جهاز جديد

### 5. ✅ Documents — Storage بدل base64
- رفع الملفات الجديدة إلى Supabase Storage bucket `documents`
- التوافقية مع base64 القديمة محفوظة

### 6. ✅ AuthGuard — API fallback
- فحص API عبر family-management/get-family-id عند غياب cached_family_id

### 7. ✅ useMyRole — staleTime
- تقليل من 30 دقيقة إلى 5 دقائق + refetchOnWindowFocus

### 8. ✅ location-api — throttle
- تقليل من 120/دقيقة إلى 10/دقيقة

### 9. ✅ eslint — no-unused-vars: "warn"

### 10. ✅ ParentDashboard — dark mode fixes

### 11. ✅ chat-api — since filter for delta sync

### 12. ✅ Chat pagination — كانت موجودة بالفعل (limit 50 + before cursor + loadOlderMessages)
