

# إصلاح التحميل الفوري لكل الصفحات — خطة محدّثة

## المشكلة
شاشة "جاري التحميل" تظهر رغم توفر البيانات محلياً، بسبب:
1. `warmCache.ts` لا يشمل كل الجداول
2. الكاش لا يُكتب عندما تكون البيانات `[]` فيبقى `undefined`

## الحل — ملفان

### ملف 1: `src/lib/warmCache.ts`

**إضافة الجداول الناقصة:**
```ts
{ table: "vaccinations", queryKeyPrefix: "vaccinations" },
{ table: "place_lists", queryKeyPrefix: "place-lists" },
{ table: "medication_logs", queryKeyPrefix: "medication-logs" },
{ table: "zakat_assets", queryKeyPrefix: "zakat-assets" },
{ table: "will_sections", queryKeyPrefix: "will" },
{ table: "profiles", queryKeyPrefix: "profiles" },
{ table: "emergency_contacts", queryKeyPrefix: "emergency-contacts" },
```

**تغيير شرط الكتابة:**
```ts
// قبل:
if (items.length > 0) {
  qc.setQueryData([queryKeyPrefix, familyId], items);
}
// بعد:
qc.setQueryData([queryKeyPrefix, familyId], items);
```

### ملف 2: `src/hooks/useOfflineFirst.ts`

**كتابة الكاش حتى لو فارغ:**
```ts
// قبل:
if (filtered.length > 0) {
  qc.setQueryData(queryKey, filtered);
}
// بعد:
qc.setQueryData(queryKey, filtered);
```

## ملاحظات مهمة
- `medication_logs` يستخدم prefix `"medication-logs"` (منفصل عن `"medications"`) لتجنب الكتابة فوق كاش الأدوية
- كتابة `[]` في الكاش تعني أن المستخدم يرى "لا توجد بيانات" فوراً بدل skeleton — وهذا هو السلوك الصحيح للـ offline-first
- كل صفحة يجب أن تعرض حالة "فارغة" مناسبة (وليس شاشة بيضاء) عندما `data.length === 0`

## ملخص
- **ملفان** فقط
- **7 جداول** جديدة في warmCache
- **إصلاح واحد** لشرط الكتابة في كلا الملفين

