

# إصلاح warmCache و syncManager — النسخة النهائية المصححة

## الملخص
3 إصلاحات في 3 ملفات. تصحيحان عن الخطة السابقة:
- إزالة `zakat_assets` و `will_sections` من `FAMILY_SCOPED_TABLES`
- `scopeKey` يكون parameter صريح في `useOfflineFirst` بدل استخراجه من `queryKey[1]`

---

## التغييرات

### 1. `src/lib/warmCache.ts` — فلترة حسب familyId للجداول الأب فقط

```ts
const FAMILY_SCOPED_TABLES = new Set([
  "task_lists", "market_lists", "calendar_events", "medications",
  "budgets", "debts", "trips", "vehicles", "document_lists",
  "albums", "family_members", "vaccinations", "place_lists",
  "worship_children", "emergency_contacts", "chat_messages",
  // لا zakat_assets ولا will_sections — هما scoped بـ user_id عبر RLS
]);
```

داخل `warmPromises`:
```ts
let items = await table.toArray();
if (FAMILY_SCOPED_TABLES.has(tableName)) {
  items = items.filter((i: any) => i.family_id === familyId);
}
qc.setQueryData([queryKeyPrefix, familyId], items);
```

### 2. `src/lib/syncManager.ts` — إضافة `postFilter` + `scopeKey`

تعديل signature لـ `syncTable`:
```ts
export async function syncTable<T extends { id: string; created_at?: string }>(
  tableName: string,
  apiFn: (lastSyncedAt: string | null) => Promise<{ data: T[] | null; error: string | null }>,
  postFilter?: (items: T[]) => T[],
  scopeKey?: string
): Promise<T[]> {
```

- `metaKey = scopeKey ? \`${tableName}:${scopeKey}\` : tableName` — يُستخدم في `getLastSyncTime` و `sync_meta.put`
- بعد `bulkPut`: `const allLocal = await table.toArray(); const filtered = postFilter ? postFilter(allLocal) : allLocal;`
- `projectPendingChanges` يبقى يستخدم `tableName` الأصلي

### 3. `src/hooks/useOfflineFirst.ts` — إضافة `scopeKey` كـ parameter صريح

إضافة في `UseOfflineFirstOptions`:
```ts
scopeKey?: string;
```

في `fetchAndSync`:
```ts
const result = await syncTable<T>(
  tableName,
  (lastSyncedAt) => apiFn(lastSyncedAt),
  filterFnRef.current || undefined,
  scopeKey
);
return applyFilter(result);
```

**كل hook عائلي يمرر `scopeKey: familyId`** — مثال:
```ts
useOfflineFirst({ table: "medications", queryKey, apiFn, scopeKey: familyId ?? undefined, ... })
```

الـ hooks غير العائلية (مثل `useKidsWorshipData`) لا تمرر `scopeKey` فتبقى بدون scope.

---

## ملخص الملفات

| الملف | التعديل |
|-------|---------|
| `src/lib/warmCache.ts` | فلترة `family_id` للجداول الأب (بدون zakat/will) |
| `src/lib/syncManager.ts` | `postFilter` + `scopeKey` في `syncTable` |
| `src/hooks/useOfflineFirst.ts` | إضافة `scopeKey` صريح + تمريره لـ `syncTable` |

