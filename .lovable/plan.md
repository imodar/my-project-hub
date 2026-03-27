

# تحليل: كيف يتم تحديد `isDefault` حاليًا ومشاكله

## الوضع الحالي

**لا يوجد عمود `is_default` في قاعدة البيانات.** التحديد يتم بالكامل في الواجهة الأمامية عبر **مقارنة الاسم**:

- **المهام**: `isDefault = type === "family" && name === "مهام العائلة"`
- **السوق**: `isDefault = type === "family" && name === "قائمة العائلة"`

### مشاكل هذا الأسلوب
1. إذا غيّر المستخدم اسم القائمة → تفقد صفة `isDefault` ويظهر لها زر حذف
2. إذا أنشأ قائمة عائلية بنفس الاسم → تُعتبر خطأً كـ `isDefault`
3. لا توجد حماية حقيقية — الحماية مبنية على نص هش

## الحل المطلوب

### 1. إضافة عمود `is_default` في قاعدة البيانات
```sql
ALTER TABLE task_lists ADD COLUMN is_default boolean NOT NULL DEFAULT false;
ALTER TABLE market_lists ADD COLUMN is_default boolean NOT NULL DEFAULT false;
```

### 2. تحديث القوائم الافتراضية الموجودة
```sql
-- تعيين أقدم قائمة عائلية في كل عائلة كافتراضية
UPDATE task_lists SET is_default = true 
WHERE id IN (
  SELECT DISTINCT ON (family_id) id FROM task_lists 
  WHERE type = 'family' ORDER BY family_id, created_at ASC
);

UPDATE market_lists SET is_default = true 
WHERE id IN (
  SELECT DISTINCT ON (family_id) id FROM market_lists 
  WHERE type = 'family' ORDER BY family_id, created_at ASC
);
```

### 3. تحديث IndexedDB (Dexie)
إضافة `is_default` ضمن البيانات المخزنة محليًا (لا يحتاج تغيير في schema لأن Dexie مرن).

### 4. تحديث Edge Functions
- **tasks-api**: عند `create-list`، إذا كان `type === "family"` ولا توجد قائمة عائلية → `is_default = true`، وإلا → `is_default = false`
- **market-api**: نفس المنطق
- **كلاهما**: منع حذف قائمة `is_default = true`

### 5. تحديث الواجهة الأمامية
- `Tasks.tsx`: استبدال `l.name === DEFAULT_FAMILY_LIST_NAME` بـ `l.is_default === true`
- `Market.tsx`: نفس الشيء
- `Documents.tsx` و `Places.tsx`: نفس المنطق إذا كانوا يستخدمون نمطًا مشابهًا

### الملفات المتأثرة
| الملف | التغيير |
|---|---|
| Migration SQL | إضافة عمود `is_default` + تحديث القوائم الموجودة |
| `supabase/functions/tasks-api/index.ts` | تعيين `is_default` عند الإنشاء + منع حذف الافتراضية |
| `supabase/functions/market-api/index.ts` | نفس الشيء |
| `src/pages/Tasks.tsx` | استبدال مقارنة الاسم بـ `is_default` |
| `src/pages/Market.tsx` | نفس الشيء |
| `src/pages/Documents.tsx` | نفس الشيء إن وُجد |
| `src/pages/Places.tsx` | نفس الشيء إن وُجد |

