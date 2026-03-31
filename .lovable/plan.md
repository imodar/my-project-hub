# تحويل التطبيق إلى Local-First حقيقي — خطة محدّثة ✅

## الحالة: مُنفّذ

### ما تم تنفيذه:

1. **كتابة bootstrap data في نقاط النجاح** ✅
   - `AuthContext.tsx`: يكتب profile في Dexie بعد جلبه من الشبكة
   - `CompleteProfile.tsx`: يكتب profile في Dexie بعد الحفظ
   - `JoinOrCreate.tsx`: يكتب family + member في Dexie بعد create/join/accept

2. **`src/lib/localBootstrap.ts`** ✅ — helper يقرأ حالة الجهاز من Dexie

3. **`useFamilyId.ts`** ✅ — ترتيب: localStorage → Dexie → network (فقط إذا لا محلي)

4. **`AuthContext.tsx`** ✅ — يقرأ profile من Dexie إذا localStorage فارغ

5. **`AuthGuard.tsx`** ✅ — يفحص Dexie قبل الشبكة + حالة offline empty

6. **`useInitialSync.ts`** ✅ — يفحص Dexie أولاً، لا blocking sync إذا فيه بيانات محلية

7. **`FirstSyncOverlay.tsx`** ✅ — يظهر فقط إذا الجهاز فارغ فعلاً

## المبدأ الأساسي

```text
المستخدم يفتح التطبيق
       ↓
Dexie فيها بيانات؟
  نعم → التطبيق يفتح فوراً + sync بالخلفية
  لا  → localStorage فيها family_id؟
         نعم → التطبيق يفتح + يجلب من API
         لا  → فيه إنترنت؟
                نعم → fullSync مع overlay
                لا  → رسالة "يحتاج اتصال أول مرة"
```
