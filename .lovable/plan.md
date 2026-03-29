

# تنفيذ تعديلين — useWill scopeKey + useInitialSync تبسيط المنطق

## الملخص

المستخدم طلب تنفيذ تعديلين من 3 ملاحظات تقنية:

| # | الملف | التعديل |
|---|-------|---------|
| 1 | `src/hooks/useWill.ts` | إضافة `scopeKey: familyId ?? undefined` للاتساق مع باقي hooks |
| 2 | `src/hooks/useInitialSync.ts` | حذف `localCount` من `db.task_lists.count()` وتبسيط المنطق ليعتمد فقط على `first_sync_done` + الكلاود |

## التغييرات

### 1. `src/hooks/useWill.ts` — سطر 27-32

إضافة `scopeKey`:
```ts
const { data, isLoading, refetch } = useOfflineFirst<any>({
  table: "will_sections",
  queryKey: key,
  apiFn,
  enabled: !!user && !!familyId,
  scopeKey: familyId ?? undefined,
});
```

### 2. `src/hooks/useInitialSync.ts` — إعادة كتابة `run`

حذف `localCount` وعدّ `task_lists` بالكامل. المنطق الجديد:

- `!firstSyncDone` → اسأل الكلاود: عنده بيانات؟ نعم = جهاز جديد → `fullSync`. لا = حساب جديد → `done`.
- `firstSyncDone` موجود → delta sync كالسابق.
- حذف import `db` لأنه لم يعد مستخدماً.

```ts
const run = useCallback(async (userId: string, familyId: string) => {
  if (ranRef.current) return;
  ranRef.current = true;
  try {
    const firstSyncDone = localStorage.getItem("first_sync_done");
    if (!firstSyncDone) {
      try {
        const { data, error } = await supabase.functions.invoke("account-api", {
          body: { action: "get-last-updated" },
        });
        if (!error && data?.last_updated_at) {
          setState("new_user");
          await fullSync(familyId, setProgress);
          setState("done");
          return;
        }
      } catch {}
      localStorage.setItem("first_sync_done", "1");
      localStorage.setItem("last_sync_ts", new Date().toISOString());
      setState("done");
      return;
    }
    // delta sync
    const localTs = localStorage.getItem("last_sync_ts");
    try {
      const { data, error } = await supabase.functions.invoke("account-api", {
        body: { action: "get-last-updated" },
      });
      if (!error && data?.last_updated_at) {
        const cloudTime = new Date(data.last_updated_at).getTime();
        const localTime = localTs ? new Date(localTs).getTime() : 0;
        if (cloudTime > localTime) {
          setState("syncing");
          await qc.invalidateQueries();
          await qc.refetchQueries({ type: "active" });
          localStorage.setItem("last_sync_ts", new Date().toISOString());
          await new Promise(r => setTimeout(r, 600));
          setState("done");
          return;
        }
      }
    } catch {}
    setState("done");
  } catch {
    setState("done");
  }
}, [qc]);
```

## ملخص
ملفان فقط، تعديل بسيط في كل منهما.

