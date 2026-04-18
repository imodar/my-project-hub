

## ملاحظات تحقق سريعة (قبل الخطة)

**النقطة #1 — أنت محق:** كل الدروَر التي ذكرتها لا تستخدم `DrawerFooter` ولا تطبّق `pb-[env(safe-area-inset-bottom)]`. تحققت من Tasbih و Trips و Debts و Zakat و Medications — كلها أزرار حفظ في `<div className="px-4">` عادي → تختبئ خلف navigation bar الأندرويد.

**النقطة #9 — أنت محق جزئياً:** الـ hooks (`useVehicles`, `useWill`, `useZakatAssets`) تستخدم `useOfflineFirst` بشكل صحيح ✅. لكن تحققت من `warmCache.ts` + `resourceRegistry.ts` — جداول `vehicles`, `zakat_assets`, `will_sections` كلها `warmPriority: "deferred"` (تحميلها مؤجل، لا تُسخّن مع البوت). لذا أول فتح للشاشة = cache فاضي = lookup من Dexie + invoke API = lodash. **الحل: ترقيتهم لـ `critical` أو إضافة pre-warm عند hover/idle.**

**النقطة #3:** الأفضل من `stopPropagation` على Backspace هو فحص `useAndroidBackButton` — قد يلتقط Backspace كزر رجوع. سأفحص ذلك أثناء التنفيذ.

**النقطة #6:** أنت محق — `type="number"` يفتح numeric keyboard على الأندرويد بشكل أفضل من `inputMode`. سأبقيه + أضيف `inputMode="decimal"` للمبالغ المالية.

**النقطة #7 — تقرير مواقع التعديل للترجمة:** سأضيف مفاتيح جديدة في `src/i18n/ar.ts` و `src/i18n/en.ts` تحت `validation.*` (required, invalidNumber, invalidDate, minLength, maxLength).

---

## الخطة الشاملة (4 دفعات منطقية)

### 🟢 دفعة A — إصلاحات سريعة وآمنة

**1. Safe-area للدروَر (12 dروَر)**
- `src/pages/Tasbih.tsx` — drawer settings + stats
- `src/pages/Trips.tsx` — add/edit/delete trip + add expense
- `src/pages/Debts.tsx` — add (لي/علي) + payment + postpone + delete
- `src/components/LanguageSheet.tsx` — language picker
- `src/pages/Zakat.tsx` — add asset + reminder + rules + delete + paid
- `src/pages/Vaccinations.tsx` — child schedule sheet
- `src/pages/Medications.tsx` — add/edit + detail + due alert + delete
- **النمط:** لفّ آخر `<div className="px-4">` بـ `<DrawerFooter>` أو إضافة `style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}`

**2. Vehicle navigation bug** — `Vehicle.tsx:L399` احذف `setSelectedCar(null)` واستبدلها بـ optimistic update.

**3. Places filter close** — `Places.tsx:L813` أضف `setShowFilters(false)` بعد `resetFilters()`.

**4. Pre-warm critical للشاشات الخفيفة** — `resourceRegistry.ts`: ترقية `vehicles`, `will_sections`, `zakat_assets` من `deferred` إلى `critical` (أو إضافة prefetch عند hover على bottom nav).

---

### 🟡 دفعة B — توحيد UX

**5. Swipe order موحّد (Primary → Edit → Delete)** — جميع الـ11 صفحة:
- Tasks, Market, Documents, Budget, Debts, Trips, Places, Vehicle, Vaccinations, Zakat, Medications
- **التغيير:** فقط ترتيب `actions` array في كل `<SwipeableCard>`.

**6. Date picker موحّد** — `Zakat.tsx`: استبدال `<Popover><Calendar/></Popover>` بـ `<Input type="date" />`.

**7. Numeric keyboard** — إضافة `inputMode="decimal"` لـ`type="number"` الموجودة (Budget, Trips, Zakat, Debts) — يبقى `type="number"` كما طلبت لفتح الكيبورد الرقمي على الأندرويد.

---

### 🔵 دفعة C — Validation + Reset (الأكبر)

**8. إنشاء utility موحّد:**
- `src/hooks/useFormValidation.ts` — hook صغير يقبل `Record<string, validator>` ويُرجع `{errors, validate, clearError, reset}`.
- `src/lib/validators.ts` — `required`, `minLength`, `numericPositive`, `validDate`, `validPhone`.

**9. إضافة مفاتيح ترجمة:** في `src/i18n/ar.ts` و `en.ts`:
```ts
validation: {
  required: "هذا الحقل مطلوب" / "This field is required",
  invalidNumber: "رقم غير صحيح" / "Invalid number",
  positiveNumber: "يجب أن يكون أكبر من صفر" / "Must be greater than zero",
  invalidDate: "تاريخ غير صحيح" / "Invalid date",
  invalidPhone: "رقم هاتف غير صحيح" / "Invalid phone number",
}
```

**10. تطبيق validation + reset على 12 dروَر** (نفس قائمة دفعة A + Calendar + Tasks + Market + Places + SOS):
- كل dروَر يستخدم `useFormValidation` + `useEffect([open])` لإعادة التعيين
- عرض رسائل تحت كل حقل: `{errors.field && <p className="text-xs text-destructive">{t.validation[errors.field]}</p>}`
- استثناء الصفحات التي تستخدم `useDraftPersistence` (Trips, Will) — reset يدوي فقط بعد submit ناجح.

---

### 🟣 دفعة D — Chat + AddPlace Map

**11. Chat scroll-to-last on mount** — `src/pages/Chat.tsx:256-263`:
```tsx
useEffect(() => {
  const t = setTimeout(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, 100);
  return () => clearTimeout(t);
}, []);
```

**12. Chat sync progress bar** — `useChat.ts`: إضافة `isSyncing` state + في `Chat.tsx`: شريط رفيع تحت الهيدر.

**13. AddPlace — خريطة inline قابلة للتوسع (لا route جديد):**
- `src/pages/AddPlace.tsx`:
  - استدعاء `Geolocation.getCurrentPosition()` على الـmount لتعيين الإحداثيات الافتراضية
  - استبدال الـ static div بخريطة Leaflet inline (نفس مكتبة `FamilyMap.tsx`)
  - زر "توسيع" يجعل الخريطة `fixed inset-0 z-50` (نفس الصفحة، لا modal، لا route)
  - زر "تأكيد" يُرجعها لحجمها الطبيعي
  - pin قابل للسحب على الخريطة → يحدّث `mapLat`/`mapLng`

**14. Backspace fix (#3)** — تحقيق أولاً عبر:
- فحص `useAndroidBackButton.ts` لو كان يلتقط Backspace
- اختبار سيناريو الصفحة المحددة عبر session replay
- تطبيق fix دقيق حسب السبب الفعلي (ليس تعديل عام على `drawer.tsx`)

---

## الملفات المعدّلة (ملخص)

| الدفعة | الملفات | عدد |
|---|---|---|
| A | Tasbih, Trips, Debts, LanguageSheet, Zakat, Vaccinations, Medications, Vehicle, Places, resourceRegistry | 10 |
| B | 11 صفحة لـ swipe + Zakat (date) + 4 ملفات (numeric) | ~12 |
| C | useFormValidation, validators, ar.ts, en.ts + 12 dروَر | 16 |
| D | Chat, useChat, AddPlace, useAndroidBackButton | 4 |
| **المجموع** | **~42 ملف عبر 4 commits** | |

## استراتيجية الـ Commits

1. `fix: safe-area للدروَر السفلية + Vehicle nav + Places filter close + warm priorities` (دفعة A)
2. `feat: توحيد ترتيب أزرار السحب + numeric keyboard + Zakat date picker` (دفعة B)
3. `feat: hook موحّد لـ form validation + reset + ترجمات + تطبيق على 12 dروَر` (دفعة C)
4. `feat: Chat scroll/progress + AddPlace خريطة inline + إصلاح Backspace` (دفعة D)

## التحقق

- **A:** افتح كل dروَر مذكور على Android، تأكد أن أزرار الحفظ فوق navigation bar.
- **B:** اسحب أي عنصر في كل صفحة، تأكد من ترتيب Primary → Edit → Delete.
- **C:** اضغط حفظ بحقول فارغة، يجب ظهور رسائل خطأ بالعربية والإنجليزية. أعد فتح dروَر، الحقول فارغة.
- **D:** افتح Chat، آخر رسالة ظاهرة. افتح AddPlace، خريطة حقيقية بموقعك. اضغط Backspace في حقل وسط النموذج، الحقول الأخرى لا تتأثر.

