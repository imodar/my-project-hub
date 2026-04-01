

# Local-First Architecture — الخطة النهائية المُنفَّذة

## الحالة: ✅ تم التنفيذ

---

## ما تم تنفيذه

### 1. Resource Registry الموحّد (`src/lib/resourceRegistry.ts`)
- مصدر واحد لكل مورد: table, queryKey, familyScoped, warm, fullSync, realtime
- إضافة `ChildTableConfig` interface لتعريف الجداول الفرعية المتداخلة
- `childTables` مُعرَّفة لـ 7 parents: trips, market_lists, task_lists, document_lists, debts, budgets, albums
- `warm: false` لجميع child tables المشتركة في queryKeyPrefix مع الأب (منع clobbering)
- يُستهلك من warmCache, fullSync, useFamilyRealtime

### 2. syncQueue تغطية كاملة (`src/lib/syncQueue.ts`)
- إضافة 8 جداول ناقصة: vaccinations, worship_children, emergency_contacts, trash_items, will_sections, trip_suggestions, prayer_logs, debt_postponements
- إضافة labels عربية لجميع الجداول
- إضافة JWT guard في `processQueue()` — لا يعالج الطابور بدون session

### 3. fullSync يفكك nested data (`src/lib/fullSync.ts`)
- بعد `bulkPut` للأب، يستخرج الأبناء والأحفاد ويكتبها في Dexie
- دعم مستويين: child tables + nested grandchildren (مثل trip_activities داخل trip_day_plans)

### 4. إصلاح Optimistic Create للقوائم
- `useMarketLists.ts`: إضافة `onSuccess` لاستبدال UUID المؤقت بالبيانات الحقيقية
- `useTaskLists.ts`: نفس الإصلاح
- لا `queryKey` على createList — الـ wrapper يتكفل بالـ optimistic

### 5. warmCache لا يكتب child tables فوق parent
- `trip_day_plans`, `trip_activities`, `trip_expenses`, `trip_packing`, `trip_suggestions`: `warm: false`
- `document_items`: `warm: false`
- `album_photos`: `warm: false`

---

## الملفات المُعدَّلة

| الملف | التعديل |
|-------|---------|
| `src/lib/resourceRegistry.ts` | ChildTableConfig type + childTables + warm:false للأبناء |
| `src/lib/syncQueue.ts` | 8 جداول ناقصة + labels + JWT guard |
| `src/lib/fullSync.ts` | استخراج nested data + persistChildTables |
| `src/hooks/useMarketLists.ts` | onSuccess لـ createList |
| `src/hooks/useTaskLists.ts` | onSuccess لـ createList |
