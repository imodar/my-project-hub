

# خطة التنفيذ: إصلاح 401 Unauthorized + Market List Bugs

## المشكلة
كل الـ Edge Functions ترجع 401 لأن Supabase gateway يتحقق من JWT بـ HS256 بينما التوكن موقّع بـ ES256. والحل: `verify_jwt = false` مع الاعتماد على التحقق اليدوي داخل الكود.

## الخطوة 1: تحديث `supabase/config.toml`
إضافة `verify_jwt = false` لكل الـ 29 Edge Function. الأمان محفوظ لأن:
- Functions المستخدم: تتحقق عبر `supabase.auth.getUser()`
- Cron jobs (trash-cleanup, account-cleanup, notification-scheduler): تتحقق من `serviceKey`

## الخطوة 2: إصلاح `src/hooks/useMarketLists.ts`
حذف `queryKey: key` من `addItem`, `updateItem`, `deleteItem` لأن `key` = `["market-lists", familyId]` خاص بالقوائم وليس العناصر. الـ optimistic update يضيف العنصر في cache القوائم فيظهر كقائمة جديدة.

التعديل:
```ts
// addItem: حذف queryKey، إبقاء onSuccess
const addItem = useOfflineMutation<any, any>({
    table: "market_items", operation: "INSERT",
    apiFn: ...,
    onSuccess: () => refetch(),  // بدون queryKey
});

// updateItem: حذف queryKey، إضافة onSuccess
const updateItem = useOfflineMutation<any, any>({
    table: "market_items", operation: "UPDATE",
    apiFn: ...,
    onSuccess: () => refetch(),
});

// deleteItem: حذف queryKey، إضافة onSuccess
const deleteItem = useOfflineMutation<any, any>({
    table: "market_items", operation: "DELETE",
    apiFn: ...,
    onSuccess: () => refetch(),
});
```

## الملفات المتأثرة
| الملف | التغيير |
|---|---|
| `supabase/config.toml` | إضافة 29 section بـ verify_jwt = false |
| `src/hooks/useMarketLists.ts` | حذف queryKey من 3 mutations |

