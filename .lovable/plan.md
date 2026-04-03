

# إصلاح: فتح drawer طلب الانضمام مرتين

## المشكلة
مصدران يستمعان لنفس الحدث:
1. `usePendingMemberAlert.ts` (عالمي) → invalidateQueries + navigate
2. `FamilyManagement.tsx` سطر 206-221 → Realtime channel يعمل refetchMembers مباشرة

كلاهما يُحدّث `members` → الـ useEffect (سطر ~149) يفتح الـ drawer → يفتح مرتين.

## الحل

### ملف واحد: `src/pages/FamilyManagement.tsx`
حذف الـ Realtime subscription (سطور 206-221) بالكامل:

```ts
// حذف هذا الكود:
useEffect(() => {
  if (!familyId) return;
  const channel = supabase.channel(`family-members-rt-${familyId}`)
    .on("postgres_changes", { ... })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [familyId, refetchMembers]);
```

الـ `usePendingMemberAlert` العالمي يتكفل بالـ invalidate، والـ useEffect الموجود يفتح الـ drawer تلقائياً.

## الملفات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `src/pages/FamilyManagement.tsx` | حذف Realtime subscription المكرر (سطور 206-221) |

**ملف واحد فقط**

