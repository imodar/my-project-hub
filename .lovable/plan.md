

# خطة تنفيذ Empty States محسّنة + Chat Guard

## 1. Empty States محسّنة (4 ملفات)

تحسين الحالات الفارغة من نص بسيط إلى تصميم احترافي (أيقونة بخلفية + عنوان + نص إرشادي):

### Tasks.tsx (سطر ~634-637)
- استبدال النص البسيط بتصميم محسّن مع أيقونة `ListChecks` بخلفية دائرية + نص إرشادي "أضف مهمة جديدة من الزر +"

### Market.tsx (سطر ~614-617)
- استبدال النص البسيط بتصميم محسّن مع أيقونة `ShoppingCart` + نص إرشادي "أضف أغراض لقائمة التسوق"

### Calendar.tsx (سطر ~335 و ~430)
- تحسين "لا توجد مناسبات قادمة" بأيقونة `CalendarDays` + نص إرشادي
- تحسين "لا توجد مناسبات في هذا اليوم" بنفس النمط

### Debts.tsx (سطر ~639-642)
- تحسين بأيقونة `CreditCard` بخلفية دائرية + نص إرشادي "سجّل ديونك لتتبعها بسهولة"

**النمط المشترك:**
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="bg-muted/50 rounded-full p-4 mb-4">
    <Icon className="h-8 w-8 text-muted-foreground" />
  </div>
  <p className="text-muted-foreground font-medium">العنوان</p>
  <p className="text-xs text-muted-foreground/70 mt-1">النص الإرشادي</p>
</div>
```

## 2. Chat Realtime Guard (ملف واحد)

### useChat.ts (سطر 284-286)
إضافة guard قبل استدعاء `decryptRef.current`:
```ts
async (payload) => {
  if (!decryptRef.current) return;  // guard ضد stale ref
  try {
    const msg = await decryptRef.current(payload.new as any);
```

---

**5 تعديلات في 5 ملفات، جميعها بسيطة ومباشرة.**

