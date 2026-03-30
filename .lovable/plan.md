

# إصلاح 4 مشاكل في تدفق الانضمام للعائلة

## التشخيص

| # | المشكلة | السبب |
|---|---------|-------|
| 1 | QR Scanner لا يعمل | يعتمد على `BarcodeDetector` API المدعوم فقط في Chrome/Edge. Firefox وSafari لا يدعمانه ولا يوجد fallback |
| 2 | درج المشرف لا يفتح تلقائياً عند طلب انضمام | `useFamilyMembers` لا يملك اشتراك Realtime — البيانات لا تتحدث إلا عند refresh يدوي |
| 3 | شاشة "بانتظار الموافقة" لا تتحدث | `family_members` غير مضاف لـ `supabase_realtime` publication. الاشتراك في الكود موجود لكنه لا يتلقى أحداثاً |
| 4 | خطأ 401 في Edge Function | استدعاءات متأخرة (stale) بعد تغيّر حالة المصادقة — موجود سابقاً ومعالج جزئياً |

---

## الحل

### 1. QR Scanner — إضافة مكتبة `jsQR` كـ fallback

**ملفان:** `src/pages/JoinOrCreate.tsx` + `src/pages/FamilyManagement.tsx`

- عند عدم توفر `BarcodeDetector`، استخدام `jsQR` (مكتبة خفيفة ~40KB):
  - رسم frame من الفيديو على canvas مخفي
  - تمرير imageData لـ `jsQR()`
  - إذا وجد QR code → استخراج الكود
- تثبيت: `jsqr` (npm package)
- الكود الحالي يبقى كما هو لـ Chrome، والـ fallback يعمل لباقي المتصفحات

### 2. Realtime لجدول `family_members` — migration جديد

**ملف:** migration SQL جديد

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
```

هذا يحل المشكلتين 2 و 3 معاً:
- شاشة العضو الجديد (JoinOrCreate) ستتلقى أحداث التحديث فعلاً
- المشرف يحتاج اشتراك Realtime أيضاً (النقطة التالية)

### 3. اشتراك Realtime في `FamilyManagement.tsx` — تحديث تلقائي للأعضاء

**ملف:** `src/pages/FamilyManagement.tsx`

إضافة `useEffect` مع اشتراك Realtime على `family_members` مفلتر بـ `family_id`:

```ts
useEffect(() => {
  if (!familyId) return;
  const channel = supabase
    .channel(`family-members-${familyId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "family_members",
      filter: `family_id=eq.${familyId}`,
    }, () => { refetchMembers(); })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [familyId]);
```

عند وصول عضو pending جديد → `refetchMembers()` → `useEffect` الموجود (سطر 148) يفتح الدرج تلقائياً.

### 4. خطأ 401 — لا تغيير مطلوب

الخطأ من استدعاءات stale أثناء logout. `useFamilyMembers` عنده guard (`getSession` قبل الاستدعاء). هذا سلوك طبيعي ولا يؤثر على المستخدم.

---

## ملخص الملفات

| الملف | التعديل |
|-------|---------|
| `package.json` | إضافة `jsqr` |
| `src/pages/JoinOrCreate.tsx` | fallback QR باستخدام jsQR + canvas |
| `src/pages/FamilyManagement.tsx` | fallback QR + اشتراك Realtime على `family_members` |
| Migration SQL | `ADD TABLE family_members` + `user_notifications` لـ `supabase_realtime` |

4 ملفات + migration واحد.

