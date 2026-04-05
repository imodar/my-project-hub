

# خطة الإصلاحات الخمسة (محدّثة)

الملف القديم `BottomNav.tsx` يبقى كما هو كاحتياط. نعيد تسمية `BottomNavWhatsApp` داخلياً فقط ونحدّث الـ import.

---

## 1. حذف console.* من Production
**الملف:** `vite.config.ts`

إضافة في الـ config object:
```ts
esbuild: {
  drop: mode === "production" ? ["console", "debugger"] : [],
},
```

---

## 2. إعادة تسمية BottomNavWhatsApp (مع الاحتفاظ بالقديم)
- **`src/components/home/BottomNavWhatsApp.tsx`**: تغيير `displayName` من `"BottomNavWhatsApp"` إلى `"BottomNav"`
- **`src/App.tsx`** سطر 26: تغيير الـ import ليكون أوضح:
```ts
import BottomNav from "@/components/home/BottomNavWhatsApp";
// يبقى كما هو — الاسم المُصدَّر هو BottomNav أصلاً
```
- **`src/components/home/BottomNav.tsx`**: يبقى كما هو بدون تعديل (احتياط)

فعلياً التغيير الوحيد هو `displayName` داخل الملف.

---

## 3. chat_messages cleanup — حد 200 رسالة في Dexie
**الملف:** `src/hooks/useChat.ts`

إضافة دالة بعد تعريف `PAGE_SIZE`:
```ts
async function trimChatMessages(familyId: string, limit = 200) {
  const all = await db.chat_messages
    .where("family_id").equals(familyId)
    .sortBy("created_at");
  if (all.length <= limit) return;
  const toRemove = all.slice(0, all.length - limit);
  await db.chat_messages.bulkDelete(toRemove.map(m => m.id));
}
```
تُنادى بعد كل `bulkPut` ناجح للرسائل.

---

## 4. fullSync batching — حد 5 calls متزامنة
**الملف:** `src/lib/fullSync.ts`

استبدال `Promise.allSettled(FULL_SYNC_STEPS.map(...))` بـ:
```ts
const BATCH = 5;
for (let i = 0; i < FULL_SYNC_STEPS.length; i += BATCH) {
  const batch = FULL_SYNC_STEPS.slice(i, i + BATCH);
  await Promise.allSettled(batch.map(async (step) => {
    // نفس المنطق الحالي بالضبط
  }));
}
```

---

## 5. إضافة Types للهوكس الرئيسية
**ملف جديد:** `src/types/entities.ts`

تعريف interfaces:
- `MarketList`, `MarketItem`
- `TaskList`, `TaskItem`
- `Debt`, `DebtPayment`, `DebtPostponement`

تحديث 3 ملفات لاستبدال `any`:
- `src/hooks/useMarketLists.ts`
- `src/hooks/useTaskLists.ts`
- `src/hooks/useDebts.ts`

---

## ملخص الملفات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `vite.config.ts` | `esbuild.drop` للـ production |
| 2 | `src/components/home/BottomNavWhatsApp.tsx` | `displayName` فقط |
| 3 | `src/hooks/useChat.ts` | `trimChatMessages` بعد bulkPut |
| 4 | `src/lib/fullSync.ts` | batching بـ 5 |
| 5 | `src/types/entities.ts` | ملف أنواع جديد |
| 6 | `src/hooks/useMarketLists.ts` | استبدال any بأنواع |
| 7 | `src/hooks/useTaskLists.ts` | استبدال any بأنواع |
| 8 | `src/hooks/useDebts.ts` | استبدال any بأنواع |

`BottomNav.tsx` القديم يبقى بدون أي تعديل كاحتياط.

