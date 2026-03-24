

# خطة إصلاح حفظ العيار (karat) في الزكاة

## المشكلة
العيار يُعرض في UI ويُستخدم بالحساب لكن **لا يُحفظ ولا يُقرأ من DB**. السطر 227: `karat: undefined`. كل حسابات الذهب خاطئة بعد إعادة فتح الصفحة.

## الحل — 3 تعديلات

### 1. Migration: إضافة عمود `karat` لجدول `zakat_assets`
```sql
ALTER TABLE public.zakat_assets ADD COLUMN IF NOT EXISTS karat integer;
```

### 2. تعديل `src/pages/Zakat.tsx`

**سطر 227 — قراءة العيار من DB:**
```
karat: a.karat ?? undefined,
```
بدل `karat: undefined`

**سطور 256-261 — إضافة karat للـ update mutation:**
```js
updateAssetMut.mutate({
  id: editingAssetId,
  type: addType,
  name: addLabel || ASSET_TYPE_META[addType].label,
  amount: Number(addAmount),
  purchase_date: addDate,
  karat: addType === "gold" ? addKarat : null,
});
```

**سطور 264-270 — إضافة karat للـ add mutation:**
```js
addAssetMut.mutate({
  type: addType,
  name: addLabel || ASSET_TYPE_META[addType].label,
  amount: Number(addAmount),
  purchase_date: addDate,
  reminder: true,
  karat: addType === "gold" ? addKarat : null,
});
```

### 3. تعديل `src/hooks/useZakatAssets.ts`

إضافة `karat` لـ type الـ input في `addAsset`:
```ts
karat?: number | null;
```

## كيف يعمل حساب القيمة بالعيار

السطر 298 موجود فعلاً وصحيح:
```
const purity = (asset.karat || 24) / 24;
return asset.amount * purity * goldPricePerGram;
```
- عيار 24 → نقاء 100% → `85 × 1.0 × 540 = 45,900 ر.س`
- عيار 18 → نقاء 75% → `85 × 0.75 × 540 = 34,425 ر.س`

سعر الذهب 24 قيراط يُجلب من API خارجي عبر `useGoldPrice()` الموجود فعلاً.

## ملخص الملفات

| الملف | التعديل |
|---|---|
| Migration جديد | `ALTER TABLE zakat_assets ADD COLUMN karat integer` |
| `src/pages/Zakat.tsx` | قراءة karat من DB + تمريرها للـ mutations |
| `src/hooks/useZakatAssets.ts` | إضافة `karat` للـ input type |

