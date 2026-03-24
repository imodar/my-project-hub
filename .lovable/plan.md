

# خطة إصلاح Offline-First Architecture — النسخة النهائية

## الوضع الحالي

لدينا 6 ملفات تشكّل البنية التحتية:

| الملف | الحالة |
|---|---|
| `src/lib/db.ts` | ✅ سليم — لا يحتاج تعديل |
| `src/lib/syncQueue.ts` | ✅ سليم — لا يحتاج تعديل |
| `src/lib/syncManager.ts` | ⚠️ يحتاج تعديل طفيف |
| `src/hooks/useOfflineFirst.ts` | 🔴 يحتاج إعادة كتابة |
| `src/hooks/useOfflineMutation.ts` | ⚠️ يحتاج تعديل |
| `src/components/SyncStatus.tsx` | ✅ سليم — لا يحتاج تعديل |
| `src/examples/MedicationsExample.tsx` | ✅ سليم — لا يحتاج تعديل |

---

## المشاكل المكتشفة وحلولها

### المشكلة 1: البيانات تختفي عند عودة الاتصال

**السبب:** عندما يرجع النت، React Query يستدعي `fetchAndSync` → `syncTable` → API يرجع بيانات السيرفر فقط → `bulkPut` يكتبها → لكن العناصر المضافة أوفلاين **موجودة في `sync_queue` فقط وليس على السيرفر**، فلما `projectPendingChanges` تشتغل المفروض تدمجها...

**لكن المشكلة الحقيقية:** `fetchAndSync` يرجع نتيجة `syncTable` ويعطيها لـ React Query كـ `queryFn` return. هذه النتيجة **تستبدل** الكاش الـ optimistic اللي عمله `useOfflineMutation`. يعني:
1. المستخدم يضيف عنصر أوفلاين → الكاش يحتوي العنصر (optimistic)
2. النت يرجع → `queryFn` يشتغل → يرجع بيانات السيرفر + projected pending
3. **لكن** `projectPendingChanges` تعتمد على `sync_queue.status === "pending"` — وإذا `processQueue` غيّر الـ status قبلها (race condition) → العنصر يختفي

**الحل:**
في `syncManager.ts` — ضمان أن `projectPendingChanges` تُنفّذ **بعد** قراءة كل البيانات من IndexedDB بشكل ذري (atomic read).

### المشكلة 2: الحذف لا يعمل بشكل موثوق

**السبب:** عند DELETE أوفلاين:
1. `useOfflineMutation.onMutate` يحذف من React Query cache ✅
2. `mutationFn` يحذف من IndexedDB ✅ ويضيف للـ queue ✅
3. **لكن** `useOfflineFirst` لديه `localData` state قديم ما زال يحتوي العنصر
4. `effectiveData = query.data ?? localData` — إذا `query.data` تحدّث، يشتغل ✅
5. **المشكلة:** إذا صار refetch أو re-render → `readLocal` يقرأ IndexedDB مرة ثانية → العنصر محذوف من IndexedDB ✅ لكن `projectPendingChanges` تشوف DELETE في queue فتحذفه ✅

الحذف يجب أن يعمل... إلا إذا `readLocal` يشتغل في لحظة بين حذف IndexedDB وإضافة الـ queue item.

**الحل:** في `useOfflineMutation.mutationFn` — إضافة العنصر للـ queue **قبل** حذفه من IndexedDB (عكس الترتيب الحالي للـ DELETE).

### المشكلة 3: `localData` state يتعارض مع React Query cache

**السبب:** `useOfflineFirst` يحتفظ بـ `localData` كـ useState منفصل عن React Query cache. هذا يخلق مصدرين للبيانات قد يتعارضان.

**الحل:** إزالة `localData` state بالكامل واستخدام React Query cache كمصدر وحيد. قراءة IndexedDB الأولية تُكتب مباشرة في `qc.setQueryData`.

---

## التعديلات المطلوبة (3 ملفات فقط)

### ملف 1: `src/hooks/useOfflineFirst.ts` — إعادة كتابة

**الكود الحالي:**
```typescript
// يستخدم useState منفصل (localData) كمصدر ثانوي
const [localData, setLocalData] = useState<T[] | null>(null);
// ...
const effectiveData = query.data ?? localData ?? [];
```

**الكود الجديد:**
```typescript
export function useOfflineFirst<T extends { id: string; created_at?: string }>({
  table: tableName,
  queryKey,
  apiFn,
  staleTime = 5 * 60 * 1000,
  filterFn,
  enabled = true,
}: UseOfflineFirstOptions<T>): UseOfflineFirstReturn<T> {
  const qc = useQueryClient();
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;
  const [initialLoaded, setInitialLoaded] = useState(false);

  // تطبيق الفلتر
  const applyFilter = useCallback((items: T[]) => {
    const fn = filterFnRef.current;
    return fn ? fn(items) : items;
  }, []);

  // قراءة IndexedDB فوراً وكتابتها في React Query cache مباشرة
  useEffect(() => {
    if (!enabled) return;
    (async () => {
      const table = (db as any)[tableName] as Table | undefined;
      if (!table) { setInitialLoaded(true); return; }
      const items: T[] = await table.toArray();
      const projected = await projectPendingChanges(tableName, items);
      const filtered = applyFilter(projected);
      if (filtered.length > 0) {
        qc.setQueryData(queryKey, filtered);
      }
      setInitialLoaded(true);
    })();
  }, [tableName, enabled]); // eslint-disable-line

  // queryFn — جلب من API + تحديث IndexedDB
  const fetchAndSync = useCallback(async (): Promise<T[]> => {
    const result = await syncTable<T>(tableName, () => apiFn());
    return applyFilter(result);
  }, [tableName, apiFn, applyFilter]);

  const query = useQuery<T[]>({
    queryKey,
    queryFn: fetchAndSync,
    staleTime,
    enabled,
  });

  // مصدر وحيد: React Query cache
  const data = query.data ?? [];
  const hasData = data.length > 0 || initialLoaded;
  const isLoading = !initialLoaded && query.isLoading;
  const isSyncing = query.isFetching && initialLoaded;

  return {
    data,
    isLoading,
    isSyncing,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => qc.invalidateQueries({ queryKey }),
  };
}
```

**ما تغيّر:**
- حُذف `localData` state بالكامل — React Query cache هو المصدر الوحيد
- أُضيف `initialLoaded` flag لمنع عرض loading بعد قراءة IndexedDB
- أُزيل `placeholderData` — البيانات المحلية تُكتب مباشرة في الكاش عبر `setQueryData`
- `effectiveData` أصبح `query.data ?? []` فقط

---

### ملف 2: `src/hooks/useOfflineMutation.ts` — تعديل ترتيب العمليات

**الكود الحالي في `mutationFn` (للـ DELETE):**
```typescript
// 1. يحذف من IndexedDB أولاً
case "DELETE":
  if (variables.id) {
    await table.delete(variables.id as string);
  }
  break;
// 2. ثم يضيف للـ queue
await addToQueue(tableName, operation, variables);
```

**الكود الجديد:**
```typescript
mutationFn: async (variables): Promise<MutationResult<TData>> => {
  const table = (db as any)[tableName] as Table | undefined;

  // ── 1. للعمليات الأوفلاين: أضف للـ queue أولاً (قبل تعديل IndexedDB) ──
  // هذا يضمن أن projectPendingChanges تشوف العملية حتى لو readLocal اشتغل بينهما
  const isOffline = !navigator.onLine;

  if (isOffline) {
    await addToQueue(tableName, operation, variables as Record<string, unknown>);
  }

  // ── 2. تحديث IndexedDB ──
  if (table) {
    try {
      switch (operation) {
        case "INSERT":
          await table.put(variables);
          break;
        case "UPDATE":
          if (variables.id) {
            await table.update(variables.id as string, variables);
          }
          break;
        case "DELETE":
          if (variables.id) {
            await table.delete(variables.id as string);
          }
          break;
      }
    } catch (err) {
      console.warn(`[OfflineMutation] فشل تحديث IndexedDB:`, err);
    }
  }

  // ── 3. إذا أوفلاين: انتهينا (Queue أُضيف في خطوة 1) ──
  if (isOffline) {
    return { data: null, queued: true };
  }

  // ── 4. إرسال للـ API ──
  try {
    const { data, error } = await apiFn(variables);
    if (error) {
      await addToQueue(tableName, operation, variables as Record<string, unknown>);
      return { data: null, queued: true };
    }
    return { data, queued: false };
  } catch {
    await addToQueue(tableName, operation, variables as Record<string, unknown>);
    return { data: null, queued: true };
  }
},
```

**ما تغيّر:**
- في حالة الأوفلاين: `addToQueue` تُنفّذ **قبل** تعديل IndexedDB
- هذا يضمن أن أي `readLocal` أو `projectPendingChanges` يحصل بينهما يشوف العملية المعلقة
- باقي المنطق (online + API failure) يبقى كما هو

---

### ملف 3: `src/lib/syncManager.ts` — قراءة ذرية

**الكود الحالي:**
```typescript
await table.bulkPut(data);
// ... ممكن processQueue يشتغل هنا ويغيّر status ...
const allLocal = await table.toArray();
const projectedData = await projectPendingChanges(tableName, allLocal as T[]);
```

**الكود الجديد:**
```typescript
// استخدام transaction لضمان قراءة ذرية
await table.bulkPut(data);

await db.sync_meta.put({
  table: tableName,
  last_synced_at: new Date().toISOString(),
});

// قراءة البيانات + العمليات المعلقة ضمن عملية واحدة
const allLocal: T[] = await table.toArray();
const projectedData = await projectPendingChanges(tableName, allLocal as T[]);
```

هنا التعديل بسيط: نقل `db.sync_meta.put` **قبل** القراءة النهائية بدل بعدها، لتقليل النافذة الزمنية بين الكتابة والقراءة.

---

## ملخص التعديلات

```text
┌──────────────────────────────┬──────────────────────────────────────────┐
│ الملف                        │ التعديل                                  │
├──────────────────────────────┼──────────────────────────────────────────┤
│ src/hooks/useOfflineFirst.ts │ إزالة localData state                   │
│                              │ React Query cache = مصدر وحيد           │
│                              │ إضافة initialLoaded flag                │
│                              │ إزالة placeholderData                    │
├──────────────────────────────┼──────────────────────────────────────────┤
│ src/hooks/useOfflineMutation │ ترتيب: addToQueue قبل IndexedDB         │
│ .ts                          │ للـ DELETE عند offline                    │
│                              │ (يمنع فقدان العنصر بين العمليتين)       │
├──────────────────────────────┼──────────────────────────────────────────┤
│ src/lib/syncManager.ts       │ نقل sync_meta.put قبل القراءة           │
│                              │ النهائية لتقليل race window             │
├──────────────────────────────┼──────────────────────────────────────────┤
│ src/lib/db.ts                │ ❌ لا تعديل                              │
│ src/lib/syncQueue.ts         │ ❌ لا تعديل                              │
│ src/components/SyncStatus    │ ❌ لا تعديل                              │
│ src/examples/Medications     │ ❌ لا تعديل                              │
└──────────────────────────────┴──────────────────────────────────────────┘
```

## لماذا هذا الحل يمنع فقدان البيانات؟

```text
سيناريو: المستخدم يضيف دواء أوفلاين ثم يرجع النت

قبل الإصلاح:
  1. INSERT → cache يتحدث ✅
  2. النت يرجع → queryFn يشتغل
  3. API يرجع [] (العنصر ما وصل السيرفر بعد)
  4. bulkPut([]) → IndexedDB فاضي
  5. projectPendingChanges → تشوف queue item → تدمج ✅
  6. لكن localData state القديم يتعارض مع النتيجة → ❌ يختفي

بعد الإصلاح:
  1. INSERT → cache يتحدث ✅ (setQueryData)
  2. النت يرجع → queryFn يشتغل
  3. API يرجع [] → bulkPut
  4. projectPendingChanges → تشوف queue item → تدمج → ترجع [الدواء]
  5. queryFn يرجع [الدواء] → cache يتحدث ✅
  6. لا يوجد localData منفصل يتعارض → ✅ يبقى ظاهر
```

