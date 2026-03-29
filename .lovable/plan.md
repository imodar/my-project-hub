

# توست مخصص موحد — AppToast (محدّث)

## التحديثات عن الخطة السابقة

### 1. دعم `description` — نعم
بعد الفحص، هناك ~15 استخدام مع `description` (خصوصاً في `Will.tsx`, `Auth.tsx`, `KidsWorship.tsx`, و`App.tsx`). التصميم سيدعم سطرين:
- **سطر أول**: العنوان (خط عادي، أبيض)
- **سطر ثاني** (اختياري): الوصف (خط أصغر، أبيض شفاف 80%)

API الجديد:
```ts
appToast.success("تم الحفظ", "تم حفظ القسم بنجاح");  // title + description
appToast.error("فشل الحفظ");                          // title فقط
```

### 2. استبدال `toast.error` في `MutationCache` قبل حذف sonner
سطر 94 في `App.tsx` سيتحول من:
```ts
toast.error("فشل الحفظ", { description: message });
```
إلى:
```ts
appToast.error("فشل الحفظ", message);
```
وكذلك سطر 137 (sync-queue-failed). هذا يضمن عدم فقدان أي رسالة خطأ بعد حذف sonner.

---

## الملفات

### ملفات جديدة (2)
| الملف | الوصف |
|-------|-------|
| `src/lib/toast.ts` | Store + API: `appToast.success/error/warning/info(title, description?)` |
| `src/components/AppToast.tsx` | مكون بصري — لسان ينزل من الأعلى، سطرين، 4 ألوان، swipe dismiss |

### تعديل (1)
| الملف | التعديل |
|-------|---------|
| `src/App.tsx` | إضافة `<AppToast />`، استبدال `toast.error` في MutationCache + sync handler بـ `appToast.error`، حذف `<Toaster />` و`<Sonner />` وimports القديمة |

### استبدال الاستخدامات (~20+ ملف)

**`toast({ title, description, variant })` من shadcn** (Auth, Will, KidsWorship):
```ts
// قبل
toast({ title: "تم الحفظ", description: "...", variant: "destructive" });
// بعد
appToast.error("تم الحفظ", "...");
```

**`toast.success/error()` من sonner** (Market, Tasks, Documents, Places, Medications, Vaccinations, Chat, Settings, CompleteProfile, JoinOrCreate, Debts, Vehicle, Albums, Trips, Trash, Budget, Calendar, Zakat, Tasbih, Profile, AdminDashboard + hooks/contexts):
```ts
// قبل
toast.success("تم الحفظ");
// بعد
appToast.success("تم الحفظ");
```

### حذف (3)
- `src/components/ui/sonner.tsx`
- `src/components/ui/toaster.tsx`
- `src/components/ui/use-toast.ts`
- `src/hooks/use-toast.ts`

---

## ملخص
- ملفان جديدان + تعديل App.tsx + استبدال في ~20+ ملف + حذف 4 ملفات قديمة
- التوست يدعم `description` اختياري (سطر ثاني بخط أصغر)
- MutationCache و sync handler يُستبدلان **قبل** حذف sonner

