

# إصلاح `tripsLocal` في Trips.tsx — إزالة الـ state المكرر

## المشكلة
`tripsLocal` هو نسخة محلية من `trips` (القادمة من DB عبر `useMemo`). كل ما يصير `invalidateQueries` بعد أي mutation، الـ `useEffect` يستبدل `tripsLocal` بالبيانات الجديدة → أي تعديل optimistic محلي (drag/drop، حذف expense inline) يضيع.

## الحل
**إزالة `tripsLocal` بالكامل** واستخدام `trips` مباشرة من `useMemo`. الأماكن القليلة اللي تستخدم `setTrips` (drag/drop و inline delete) لازم تتحول لتعمل على `selectedTrip` فقط لأن:
- الـ drag/drop يغيّر ترتيب الأنشطة → هذا UI-only ولا يرسل للـ DB أصلاً
- حذف expense يستدعي `deleteExpense.mutate` → الـ invalidate يرجّع البيانات الصحيحة

## التعديلات في `src/pages/Trips.tsx`

### 1. إزالة الـ state والـ effect (سطور 234-237)
```
// حذف:
const [tripsLocal, setTripsLocal] = useState<Trip[]>([]);
useEffect(() => { setTripsLocal(trips); }, [trips]);
const setTrips = setTripsLocal;
```

### 2. تعديل `filteredTrips` (سطر 296)
```js
// من:
const filteredTrips = tripsLocal.filter((t) => t.type === activeTab);
// إلى:
const filteredTrips = trips.filter((t) => t.type === activeTab);
```

### 3. تعديل `handleDrop` (سطر 497)
```js
// حذف سطر:
setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
// الإبقاء على:
setSelectedTrip(updated);
```
الـ drag/drop يعدّل `selectedTrip` فقط — عرض القائمة الرئيسية لا يحتاج التحديث لأن المستخدم داخل تفاصيل الرحلة.

### 4. تعديل inline expense delete (سطر 826)
```js
// حذف سطر:
setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
// الإبقاء على:
setSelectedTrip(updated);
deleteExpense.mutate(exp.id);
```
الـ mutation يعمل invalidate → `trips` يتحدث تلقائياً.

## ملخص

| التعديل | السطر | الوصف |
|---|---|---|
| حذف `tripsLocal` state + effect | 234-237 | إزالة الـ state المكرر |
| `filteredTrips` | 296 | استخدام `trips` مباشرة |
| `handleDrop` | 497 | حذف `setTrips` |
| inline delete | 826 | حذف `setTrips` |

ملف واحد فقط: `src/pages/Trips.tsx`. لا تعديل على أي ملف آخر.

