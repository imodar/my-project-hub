

# إصلاح المشاكل المتبقية — خطة نهائية محدثة

## تحقق: debt_postponements ✓

الجدول موجود في الـ schema بأعمدة: `id`, `debt_id`, `reason`, `new_date`, `created_at`. آمن للاستخدام في restore.

---

## 1. trash-api restore — إضافة 9 أنواع ناقصة (حرج)

الـ restore حالياً يعيد `market_list` و `task_list` فقط. الأنواع التسعة الباقية تُعلَّم `restored: true` لكن لا تُدخَل في جداولها.

إضافة `else if` blocks لكل نوع:

| النوع | الجدول الرئيسي | السجلات المرتبطة |
|-------|---------------|-----------------|
| `document_list` | `document_lists` | `document_items` + `document_files` |
| `place_list` | `place_lists` | `places` |
| `trip` | `trips` | `trip_day_plans` + `trip_activities` + `trip_expenses` + **`trip_packing`** + `trip_suggestions` + `trip_documents` |
| `album` | `albums` | `album_photos` |
| `budget` | `budgets` | `budget_expenses` |
| `debt` | `debts` | `debt_payments` + `debt_postponements` |
| `medication` | `medications` | (بدون related) |
| `vehicle` | `vehicles` | `vehicle_maintenance` |
| `calendar_event` | `calendar_events` | (بدون related) |

كل block: insert `originalData` عبر `adminClient`، ثم insert `relatedRecords` إن وُجد. إذا فشل insert الرئيسي → return error قبل `restored: true`.

**ملف**: `supabase/functions/trash-api/index.ts`

---

## 2. Trips.tsx — استبدال localStorage بـ useAlbums

`localStorage.getItem("family-albums")` + demo data hardcoded لـ `id="1"`.

استبداله بـ `useAlbums()` وربط الألبوم عبر `albums.find(a => a.linked_trip_id === selectedTrip.id)`.

**ملف**: `src/pages/Trips.tsx`

---

## 3. PullToRefresh وهمي — 8 صفحات

استبدال `setTimeout(...)` بـ `queryClient.invalidateQueries(...)`:

| الصفحة | Query Key |
|--------|-----------|
| `Index.tsx` | بدون filter (الكل) |
| `Will.tsx` | `["will"]` |
| `Places.tsx` | `["place-lists"]` |
| `Documents.tsx` | `["document-lists"]` |
| `Tasks.tsx` | `["task-lists"]` |
| `Market.tsx` | `["market-lists"]` |
| `Vehicle.tsx` | `["vehicles"]` |
| `Albums.tsx` | `["albums"]` |

**ملفات**: 8 صفحات

---

## 4. usePlaceLists — تحويل لـ useOfflineMutation

تحويل `createList`, `deleteList`, `addPlace`, `updatePlace`, `deletePlace` من `useMutation` إلى `useOfflineMutation`.

**ملف**: `src/hooks/usePlaceLists.ts`

---

## 5. Settings toggleMemberSOS — إزالة

حذف الـ handler + الـ Switch UI + الـ state لأنه local فقط ولا يُحفظ في DB.

**ملف**: `src/pages/Settings.tsx`

---

## ترتيب التنفيذ

1. trash-api restore (حرج — فقدان بيانات)
2. Trips.tsx localStorage → useAlbums
3. PullToRefresh × 8 صفحات → invalidateQueries
4. usePlaceLists → useOfflineMutation
5. Settings toggleMemberSOS → حذف

