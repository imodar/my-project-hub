

# تحديث الخطوة 3 — AuthGuard

## الملاحظة
صحيحة 100%. عرض children لمستخدم جديد بدون عائلة سيسبب "flash" مربك.

## المنطق المحدّث

```text
cached_family_id موجود?
  ├─ نعم → عرض children فوراً ✅
  └─ لا →
       join_or_create_done موجود?
         ├─ نعم → عرض children + جلب API بالخلفية 🔄
         └─ لا → Navigate("/join-or-create") مباشرة 🚀
```

هذا يغطي 3 حالات:
1. **مستخدم عادي** (cached_family_id موجود): أسرع مسار، 0ms
2. **مستخدم مسح الكاش** (join_or_create_done موجود بس الـ ID راح): يعرض UI + يجلب الـ ID بالخلفية
3. **مستخدم جديد** (لا هذا ولا هذا): redirect فوري بدون أي flash

## التأثير على الملفات
نفس الملف `src/components/AuthGuard.tsx` — المنطق يصير synchronous بالكامل:

```typescript
const cachedFamilyId = localStorage.getItem("cached_family_id");
const joinDone = localStorage.getItem("join_or_create_done");

if (cachedFamilyId) {
  // مسار سريع — عرض children
} else if (joinDone) {
  // عرض children + جلب API بالخلفية
} else {
  // مستخدم جديد — redirect فوري
  return <Navigate to="/join-or-create" replace />;
}
```

## الخطة الكاملة المحدّثة (7 ملفات)

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `src/lib/resourceRegistry.ts` | إضافة `warmPriority` لكل entry |
| 2 | `src/lib/warmCache.ts` | تقسيم لمرحلتين (critical: 3 جداول → deferred: الباقي) |
| 3 | `src/hooks/useOfflineFirst.ts` | تبسيط — إزالة IndexedDB read + state، اعتماد على React Query cache |
| 4 | `src/components/AuthGuard.tsx` | المنطق الثلاثي أعلاه — sync localStorage فقط، بدون Dexie/spinner |
| 5 | `src/components/RoleGuard.tsx` | عرض children فوراً مع role افتراضي |
| 6 | `src/components/PageHeader.tsx` | إزالة SyncStatus |
| 7 | `src/components/SyncStatus.tsx` | polling 15s بدل useLiveQuery (للـ Settings فقط) |

**7 ملفات، بدون migration**

