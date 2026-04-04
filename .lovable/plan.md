

# إضافة اسم الشخص الذي أضاف العنصر — السوق والمهام

## الوضع الحالي

| | السوق (market_items) | المهام (task_items) |
|---|---|---|
| عمود `added_by` بالداتابيز | موجود (uuid, nullable) | غير موجود |
| API يحفظ `added_by` | نعم (عند add-item) | لا |
| API يرجع `added_by` | نعم (ضمن `select("*")`) | لا يوجد عمود |
| الواجهة تعرضه | لا — `addedBy: ""` دائماً | لا |

## التغييرات المطلوبة

### 1. Migration — إضافة `added_by` لجدول `task_items`
```sql
ALTER TABLE task_items ADD COLUMN added_by uuid;
```
عمود واحد، nullable، بدون foreign key (نفس نمط market_items).

### 2. Edge Function: `tasks-api/index.ts`
- **add-item**: حفظ `added_by: userId` عند الإدراج (نفس ما يفعله market-api)
- **get-lists**: بدون تغيير — `select("*, task_items(*)")` سيرجع العمود الجديد تلقائياً

### 3. Edge Function: `market-api/index.ts`
- بدون تغيير — `added_by` يُحفظ ويُرجع أصلاً

### 4. الواجهة: `src/pages/Market.tsx`
- في الـ `useMemo` (سطر 92-98): بدل `addedBy: ""` → ابحث عن اسم العضو من `FAMILY_MEMBERS` باستخدام `i.added_by`
- في `renderItem` (سطر 407): يعرض الاسم أصلاً — سيعمل تلقائياً

### 5. الواجهة: `src/pages/Tasks.tsx`
- في الـ `useMemo`: أضف حقل `addedByName` لكل item من `i.added_by` مقارنة مع أعضاء العائلة
- في `renderItem` (سطر 430): أضف سطر يعرض اسم المضيف تحت الملاحظة

### 6. Hook: `useTaskLists.ts`
- في `addItem.mutate`: أضف `added_by: user?.id` للـ payload المحلي (optimistic)

### 7. Hook: `useMarketLists.ts`
- في `addItem.mutate`: أضف `added_by: user?.id` للـ payload المحلي (optimistic)

## الملفات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | Migration | `ALTER TABLE task_items ADD COLUMN added_by uuid` |
| 2 | `supabase/functions/tasks-api/index.ts` | إضافة `added_by: userId` في add-item |
| 3 | `src/pages/Market.tsx` | ربط `added_by` باسم العضو من FAMILY_MEMBERS |
| 4 | `src/pages/Tasks.tsx` | نفس الشيء + عرض الاسم في renderItem |
| 5 | `src/hooks/useTaskLists.ts` | إضافة `added_by` في optimistic payload |
| 6 | `src/hooks/useMarketLists.ts` | إضافة `added_by` في optimistic payload |

**6 تغييرات، migration واحد**

