

# Full Sync مع Progress Bar — الخطة الكاملة النهائية

## المشكلة
على جهاز جديد، `useInitialSync` يستخدم `refetchQueries({ type: "active" })` الذي يجلب فقط بيانات الصفحة المفتوحة (Home). باقي البيانات لا تُجلب حتى يفتح المستخدم كل صفحة يدوياً.

## الحل — 3 ملفات

### 1. `src/lib/fullSync.ts` — ملف جديد

يحتوي على:
- `SyncProgress` interface: `{ current: number; label: string }`
- `SYNC_STEPS` array: 12 جدول (المهام، السوق، التقويم، الأدوية، الميزانية، الديون، الرحلات، الوثائق، الأماكن، الألبومات، المركبات، اللقاحات)
- `fullSync(familyId, onProgress)`: يمر على كل step بالتسلسل، يستدعي Edge Function المناسبة، يكتب النتائج في IndexedDB عبر `db[table].bulkPut(items)`، ويحدث progress. فشل جدول واحد لا يوقف الباقي.
- عند الانتهاء يضبط `first_sync_done` و `last_sync_ts` في localStorage.

### 2. `src/hooks/useInitialSync.ts` — تعديل

**التغييرات:**
- إضافة `import { fullSync } from "@/lib/fullSync"`
- إضافة `progress` state: `useState({ current: 0, label: "" })`
- تغيير signature الـ `run` ليستقبل `familyId` كـ parameter ثاني: `run(userId: string, familyId: string)`
- **حالة new_user فقط** (سطر 35-44): استبدال `invalidateQueries` + `refetchQueries` + `setTimeout(800)` بـ:
  ```ts
  setState("new_user");
  await fullSync(familyId, setProgress);
  setState("done");
  ```
- **حالة syncing** (سطر 69-76): تبقى كما هي — `invalidateQueries` + `refetchQueries` كافية لأن البيانات موجودة محلياً والكلاود أحدث فقط.
- إرجاع `progress` من الـ hook: `return { state, run, progress }`

### 3. `src/components/FirstSyncOverlay.tsx` — تعديل

**التغييرات:**
- إضافة `import { useFamilyId } from "@/hooks/useFamilyId"`
- إضافة `import { Progress } from "@/components/ui/progress"`
- استخدام `progress` من `useInitialSync()`
- استخدام `familyId` من `useFamilyId()` وتمريره لـ `run(user.id, familyId)` بدل الاعتماد على localStorage
- إضافة شرط: لا تبدأ الـ sync إلا بعد توفر `familyId`
- إضافة Progress bar و label تحت الـ spinner:
  ```tsx
  <Progress value={progress.current} className="w-48 h-2" />
  <p className="text-xs text-muted-foreground mt-2">
    {progress.label} — {progress.current}%
  </p>
  ```

## ملاحظات
- `familyId` يُمرر كـ parameter مباشر من `useFamilyId()` hook — لا يعتمد على `localStorage.getItem("cached_family_id")` الذي قد يكون null
- حالة `syncing` (بيانات محلية + كلاود أحدث) لا تحتاج fullSync — يكفي `invalidateQueries`
- حالة `new_user` (جهاز جديد بدون بيانات) هي الوحيدة التي تستخدم fullSync الكامل

## النتيجة
- جهاز جديد → overlay + progress bar 0%→100% → كل البيانات في IndexedDB → overlay يختفي → كل الشاشات تفتح فوراً
- نفس الجهاز → `first_sync_done` موجود → لا overlay

