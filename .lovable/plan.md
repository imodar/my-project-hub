

# خطة تنفيذ Offline-First Architecture

## الملفات المطلوبة (8 ملفات جديدة — لا تعديل على أي ملف موجود)

### 1. تثبيت التبعيات
- `dexie` + `dexie-react-hooks`

### 2. `src/lib/db.ts` — قاعدة بيانات Dexie.js
- Class `AppDatabase extends Dexie` مع 30+ جدول مطابق لـ Supabase
- `sync_queue`: `++id, table, operation, data, created_at, status, retries`
- `sync_meta`: `table, last_synced_at`
- تصدير instance `db`

### 3. `src/lib/syncQueue.ts` — طابور المزامنة
- `TABLE_API_MAP` = placeholder فارغ `{}` جاهز للربط
- `addToQueue(table, operation, data)` — حفظ عملية معلقة
- `processQueue()` — معالجة FIFO مع retry ×3
- `window.addEventListener('online', processQueue)` تلقائي
- إذا الجدول غير مربوط بالـ map: يبقى pending

### 4. `src/lib/syncManager.ts` — مدير المزامنة
- `syncTable<T>(tableName, apiFn)` — جلب API → تحديث IndexedDB
- `syncAll()` — مزامنة جميع الجداول
- `getLastSyncTime(tableName)` — قراءة آخر timestamp
- بنية Delta sync جاهزة

### 5. `src/hooks/useOfflineFirst.ts` — Hook قراءة
- يقرأ IndexedDB فوراً كـ `initialData`
- background fetch عبر `useQuery`
- `isLoading = false` مع بيانات محلية
- `isSyncing` أثناء الجلب

### 6. `src/hooks/useOfflineMutation.ts` — Hook كتابة
- Optimistic update لـ IndexedDB + UI فوراً
- إرسال API في الخلفية
- فشل/offline → `addToQueue` تلقائياً
- invalidate queryKey عند النجاح

### 7. `src/components/SyncStatus.tsx` — مؤشر الحالة
- `useLiveQuery` لمراقبة pending count
- أخضر/برتقالي/رمادي dot + عدد المعلق

### 8. `src/examples/MedicationsExample.tsx` — مثال توضيحي
- صفحة مستقلة تماماً (لا تُضاف للـ router)
- توضح استخدام `useOfflineFirst` لجلب الأدوية من IndexedDB + API
- توضح استخدام `useOfflineMutation` لإضافة دواء مع optimistic update
- تعرض `SyncStatus` كمكون
- تحتوي تعليقات توضيحية بالعربية لكل خطوة

---

## ترتيب التنفيذ
1. تثبيت dexie → 2. db.ts → 3. syncQueue.ts → 4. syncManager.ts → 5. useOfflineFirst.ts → 6. useOfflineMutation.ts → 7. SyncStatus.tsx → 8. MedicationsExample.tsx

