

# الخطة المحدّثة — 4 إصلاحات

## ملخص التحقق من المشكلة 3

- **`prayer_logs.child_id`**: UUID يُشير إلى `worship_children.id` — مؤكد من الكود (سطر 61, 82 في worship-api). Policy عبر `worship_children` تعمل.
- **`kids_worship_data.child_id`**: TEXT — قد يكون UUID من `worship_children` أو `"default"` (سطر 26 في KidsWorship.tsx). لا يوجد عمود `user_id` في الجدول أصلاً.

**النتيجة**: لا يمكن ربط `kids_worship_data` بـ `worship_children` ولا بـ `user_id` بدون migration لإضافة العمود.

---

## المشكلة 1 — Zakat payment queue replay

**الإصلاح**: إضافة `zakat_history` في `TABLE_API_MAP` بـ `INSERT: "pay-zakat"` وتغيير `addZakatPayment` ليستخدم `table: "zakat_history"`.

**ملفات**: `src/lib/syncQueue.ts`, `src/hooks/useZakatAssets.ts`

---

## المشكلة 2 — useFamilyRealtime online spike

**الإصلاح**: إضافة jitter عشوائي (0-60 ثانية) في `onOnline`:

```ts
const onOnline = () => {
  const jitter = Math.random() * 60_000;
  setTimeout(() => invalidateAll(), jitter);
};
```

**ملف**: `src/hooks/useFamilyRealtime.ts`

---

## المشكلة 3 — RLS لـ prayer_logs و kids_worship_data

### أ) prayer_logs — ربط بـ worship_children (child_id = UUID مؤكد)

```sql
-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Authenticated access prayer logs" ON prayer_logs;
DROP POLICY IF EXISTS "Authenticated delete prayer logs" ON prayer_logs;
DROP POLICY IF EXISTS "Authenticated insert prayer logs" ON prayer_logs;
DROP POLICY IF EXISTS "Authenticated update prayer logs" ON prayer_logs;

-- سياسة واحدة: الوصول فقط لأفراد العائلة عبر worship_children
CREATE POLICY "Family access prayer logs" ON prayer_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM worship_children wc
      WHERE wc.id = prayer_logs.child_id
      AND is_family_member(auth.uid(), wc.family_id)
    )
  );
```

### ب) kids_worship_data — إضافة عمود user_id ثم policy

الجدول لا يملك `user_id` ولا يمكن ربطه بـ `worship_children` لأن `child_id` قد يكون `"default"`.

**Migration**:
```sql
-- إضافة عمود user_id
ALTER TABLE kids_worship_data ADD COLUMN user_id uuid;

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Authenticated access kids worship" ON kids_worship_data;
DROP POLICY IF EXISTS "Authenticated delete kids worship" ON kids_worship_data;
DROP POLICY IF EXISTS "Authenticated insert kids worship" ON kids_worship_data;
DROP POLICY IF EXISTS "Authenticated update kids worship" ON kids_worship_data;

-- سياسة: المستخدم يصل لبياناته فقط
CREATE POLICY "Users access own worship data" ON kids_worship_data
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**تعديل الكود**: في `worship-api/index.ts`، عند `save-worship-data` و `insert`، إضافة `user_id: userId` للـ insert. عند `get-worship-data`، إضافة `.eq("user_id", userId)` بجانب `child_id`. عند `delete-worship-data`، نفس الشيء.

**ملف**: `supabase/functions/worship-api/index.ts` + migration

---

## المشكلة 4 — useDocumentLists (تأكيد: لا مشكلة)

`createList` عنده `queryKey: key` → `useOfflineMutation.onMutate` يعمل optimistic تلقائياً. لا إصلاح مطلوب.

---

## ملخص الملفات

| الملف | التغيير |
|---|---|
| `src/lib/syncQueue.ts` | إضافة `zakat_history` entry |
| `src/hooks/useZakatAssets.ts` | تغيير table لـ `addZakatPayment` |
| `src/hooks/useFamilyRealtime.ts` | إضافة jitter عند online |
| `supabase/functions/worship-api/index.ts` | إضافة `user_id` في insert/select/delete لـ `kids_worship_data` |
| Migration | إضافة `user_id` لـ `kids_worship_data` + RLS لكلا الجدولين |

**5 ملفات + 1 migration**

