
السبب الحقيقي باختصار:

- الخطة الكبيرة التي تتكلم عن `Registry` موحّد + `Queue v2` + `Aggregate-root local model` لم تُنفَّذ أصلاً.
- الذي تم اعتماده وتنفيذه فعلياً هو الخطة الأصغر الموجودة حالياً في `.lovable/plan.md`: 11 ملفاً فقط، لمعالجة 6 مشاكل محددة.
- لذلك الذي حدث كان patch محدود، وليس refactor معماري شامل.

الدليل من الكود الحالي:
- `src/lib/warmCache.ts` ما زال يملك `TABLES_TO_WARM` يدوياً.
- `src/lib/fullSync.ts` ما زال يملك `SYNC_STEPS` يدوياً.
- `src/hooks/useFamilyRealtime.ts` ما زال يملك `QUERY_KEYS_TO_REFETCH` يدوياً.
- `src/lib/syncQueue.ts` ما زال يعتمد `table + operation` عبر `TABLE_API_MAP`، وليس `functionName + action + payload + scope`.
- `src/hooks/useOfflineMutation.ts` ما زال يعمل optimistic update عام لصفوف flat arrays فقط، ولا يثبت aggregate shape للأب.
- `src/hooks/useMarketLists.ts` و`src/hooks/useTaskLists.ts` ما زالا يملكان `createList` بدون `queryKey` وبدون `qc.setQueryData` يدوي، لذلك القائمة لا تظهر فوراً.
- `src/hooks/useCalendarEvents.ts`, `src/hooks/useVehicles.ts`, `src/hooks/useWill.ts`, `src/hooks/useMedications.ts` ما زالت تعتمد `refetch()` كحل جزئي، وهذا يثبت أن standard واحد لم يُطبَّق على كل الشاشات.

الخلاصة:
- نعم، بعض الإصلاحات طُبقت فعلاً.
- لكن الخطة التي تمنع رجوع المشاكل لم تُطبَّق بعد، لأن التنفيذ السابق كان لخطة أصغر بكثير، ولأن الطبقات الأساسية ما زالت منفصلة.

الخطة النهائية المحدثة الصحيحة:

### المرحلة 1 — إيقاف الـ regressions الحالية فوراً
الهدف: إعادة السلوك الفوري للقوائم الآن.
- `src/hooks/useMarketLists.ts`: إضافة optimistic create حقيقي داخل wrapper `createList` عبر `qc.setQueryData`.
- `src/hooks/useTaskLists.ts`: نفس الإصلاح.
- مراجعة create-list في `useDocumentLists.ts` و`usePlaceLists.ts` للتأكد أن سلوكهما ثابت ومقصود.

### المرحلة 2 — توحيد التسجيل في Registry واحد
الهدف: منع drift بين الملفات.
- إنشاء registry مركزي واحد يصف لكل resource:
  - `table`
  - `queryKey`
  - `familyScoped`
  - `warmCache`
  - `fullSync`
  - `realtime`
  - `queue mapping`
- تحويل:
  - `src/lib/warmCache.ts`
  - `src/lib/fullSync.ts`
  - `src/hooks/useFamilyRealtime.ts`
  لقراءة نفس الـ registry بدل القوائم اليدوية المنفصلة.

### المرحلة 3 — Queue v2 بدل table+operation
الهدف: جعل إعادة الإرسال صريحة وصحيحة.
- تحديث:
  - `src/lib/db.ts`
  - `src/lib/syncQueue.ts`
  - `src/hooks/useOfflineMutation.ts`
- بحيث يصبح سجل الطابور يحتوي:
  - `functionName`
  - `action`
  - `payload`
  - `scopeKey`
  - `resource`
- وتغطية الحالات التي لا ينفع فيها `table + operation` مثل:
  - `pay-zakat`
  - `add-postponement`
  - `update-suggestion-status`
  - `will`
  - `vaccinations`
  - `worship_children`
  - list actions الخاصة بالمهام/السوق/الوثائق/الأماكن

### المرحلة 4 — اعتماد Aggregate-Root محلي لكل الشاشات المركبة
الهدف: أن يبقى التغيير بعد reload/offline restart.
- عند أي nested mutation يتم patch على:
  - React Query cache
  - صف الأب في Dexie
- وليس فقط child table أو cache session.
- يطبق على:
  - Market
  - Tasks
  - Documents
  - Places
  - Budgets
  - Debts
  - Trips
  - Vehicles
  - Zakat
  - Medications
  - Will
  - Albums
  - Vaccinations

### المرحلة 5 — توحيد الشاشات النصف محلية
الهدف: إزالة الخلط بين optimistic وrefetch وqueue الناقص.
- تحويل هذه الـ hooks إلى نفس العقد:
  - `src/hooks/useCalendarEvents.ts`
  - `src/hooks/useVehicles.ts`
  - `src/hooks/useVaccinations.ts`
  - `src/hooks/useWorshipChildren.ts`
  - `src/hooks/useWill.ts`
  - `src/hooks/useMedications.ts`
- القاعدة:
  - إمّا aggregate patch صحيح
  - أو exception موثق ومؤقت

### المرحلة 6 — إكمال Local Reads للشاشات الخارجة عن النظام
الهدف: كل شاشة تفتح من اللوكال أولاً.
- `src/hooks/useMyRole.ts`
- `src/pages/Profile.tsx`
- `src/pages/Settings.tsx`
- `src/contexts/TrashContext.tsx`
- `src/hooks/useNotifications.ts`
- `src/hooks/useTasbihSessions.ts`
- `src/hooks/useKidsWorshipData.ts`
- `src/pages/Map.tsx` بآخر known local data مع إبقاء البث الحي online-first

### المرحلة 7 — تثبيت bootstrap والهوية المحلية
الهدف: أي جهاز سبق استخدامه يفتح فوراً.
- توحيد الكتابات المحلية الدنيا في:
  - `src/contexts/AuthContext.tsx`
  - `src/hooks/useFamilyId.ts`
  - `src/pages/CompleteProfile.tsx`
  - `src/pages/JoinOrCreate.tsx`
  - `src/pages/Profile.tsx`
- توسيع `signOut` لمسح كل الجداول المحلية والـ sync metadata الجديدة.

### المرحلة 8 — تغطية التحديث بين الأجهزة من نفس الـ Registry
الهدف: الجهاز الثاني لا يبقى stale.
- توسيع refresh/invalidation ليشمل:
  - `zakat-assets`
  - `will`
  - `worship-children`
  - `trash-items`
  - `my-family-role`
  - keys الخاصة بـ settings/profile/notifications
- ويكون المصدر هو الـ registry نفسه، لا قوائم منفصلة.

### المرحلة 9 — قفل الرجوع باختبارات إلزامية
الهدف: عدم تكرار نفس المشكلة لاحقاً.
- اختبارات يدوية + Playwright تغطي:
  1. جهاز جديد بعد OTP يظهر sync overlay مرة واحدة
  2. reload بدون نت يفتح فوراً إذا توجد بيانات
  3. إنشاء قائمة سوق/مهام يظهر فوراً
  4. إنشاء قائمة يبقى بعد reload offline
  5. nested item يبقى بعد reload offline
  6. queue يعيد المزامنة عند رجوع النت
  7. جهاز ثانٍ يرى التغييرات بعد focus/online
  8. signOut ينظف Dexie بالكامل

الترتيب التنفيذي الصحيح:
1. المرحلة 1 أولاً لإصلاح السلوك المكسور حالياً
2. المرحلة 2 و3 لتثبيت البنية الأساسية
3. المرحلة 4 و5 لتحويل الشاشات المركبة والنصف محلية
4. المرحلة 6 و7 لإكمال bootstrap/local reads
5. المرحلة 8 و9 لإغلاق ملف الرجوع نهائياً

الخلاصة التنفيذية:
- لم يتم تنفيذ “الخطة الكبيرة” لأن الخطة المعتمدة فعلياً كانت أصغر منها بكثير.
- الكود الحالي يثبت أن refactor المعماري لم يبدأ بعد.
- إذا المطلوب فعلاً أن “ما عاد ترجع تخرب”، فلا يكفي patch جديد؛ المطلوب تنفيذ المراحل التسع أعلاه بالترتيب، بدءاً من إصلاح `useMarketLists` و`useTaskLists` ثم توحيد الـ Registry والـ Queue والـ Aggregate persistence.
