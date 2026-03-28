

# إصلاح bug التكرار — تعديل useOfflineMutation.ts فقط

## التقييم

الحل ممتاز. بدل تعديل 6 ملفات وحذف `queryKey`، نعدل ملف واحد (`useOfflineMutation.ts`) ونحل المشكلة لكل INSERT في التطبيق دفعة واحدة. المنطق سليم:

- API رجع `data` حقيقي → استبدل الـ optimistic item (بـ UUID المؤقت) بالحقيقي
- API رجع `null` → fallback لـ `invalidateQueries` (الحالة النادرة)
- فحص `exists` يحمي من حالة الـ race condition (لو الـ real item وصل قبل الاستبدال)

## التعديل

### `src/hooks/useOfflineMutation.ts` — سطر 144-150

استبدال:
```ts
onSuccess: (result, variables) => {
  if (!result.queued && queryKey) {
    qc.invalidateQueries({ queryKey });
  }
  onSuccess?.(result.data, variables);
},
```

بـ:
```ts
onSuccess: (result, variables) => {
  if (!result.queued && queryKey) {
    if (result.data && operation === "INSERT") {
      qc.setQueryData<Record<string, unknown>[]>(queryKey, (old) => {
        if (!old) return old;
        const realId = (result.data as any)?.id;
        if (old.some(item => item.id === realId)) return old;
        return old.map(item =>
          item.id === variables.id ? result.data as Record<string, unknown> : item
        );
      });
    } else {
      qc.invalidateQueries({ queryKey });
    }
  }
  onSuccess?.(result.data, variables);
},
```

ملاحظة: أضفت شرط `operation === "INSERT"` لأن UPDATE/DELETE لا يحتاجان استبدال — يكفيهم `invalidateQueries`.

## النتيجة
- ملف واحد فقط
- كل INSERT في التطبيق يستفيد تلقائياً — optimistic فوري + لا تكرار
- UPDATE/DELETE يبقون على `invalidateQueries` كالعادة

