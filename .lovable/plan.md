

# تحويل التطبيق إلى Local-First حقيقي — خطة محدّثة

## الترتيب الصحيح (8 أولاً)

ملاحظتك صحيحة 100%: إذا بنينا طبقة bootstrap تقرأ من Dexie لكن Dexie فارغة من profile/family → نفس المشكلة. لذلك نبدأ بكتابة البيانات أولاً.

---

### الخطوة 1 — كتابة bootstrap data في نقاط النجاح

**الهدف:** ضمان أن Dexie تحتوي الحد الأدنى بعد أي عملية ناجحة.

**`src/contexts/AuthContext.tsx`** — بعد جلب البروفايل بنجاح:
```ts
// داخل networkFetch() بعد الحصول على data.data
await db.profiles.put({
  id: userId,
  name: data.data.name,
  phone: data.data.phone || null,
  avatar_url: data.data.avatar_url || null,
});
```

**`src/pages/CompleteProfile.tsx`** — بعد حفظ البروفايل بنجاح:
```ts
await db.profiles.put({
  id: user.id,
  name: trimmed,
  avatar_url: avatarUrl || null,
});
```

**`src/pages/JoinOrCreate.tsx`** — بعد إنشاء عائلة بنجاح:
```ts
const familyData = data?.data;
if (familyData?.family_id) {
  await db.families.put({
    id: familyData.family_id,
    name: profileName,
    created_by: session.user.id,
  });
  await db.family_members.put({
    id: familyData.member_id || crypto.randomUUID(),
    family_id: familyData.family_id,
    user_id: session.user.id,
    role: createRole,
    is_admin: true,
    status: "active",
  });
}
```

بعد قبول الانضمام (realtime accepted):
```ts
if (pendingJoinFamilyId) {
  await db.family_members.put({
    id: crypto.randomUUID(),
    family_id: pendingJoinFamilyId,
    user_id: session.user.id,
    status: "active",
  });
}
```

**`src/hooks/useInitialSync.ts`** — بعد fullSync ناجح، البيانات تُكتب تلقائياً بواسطة fullSync (bulkPut) فلا حاجة لتغيير إضافي.

---

### الخطوة 2 — إنشاء `src/lib/localBootstrap.ts`

ملف helper يقرأ Dexie بشكل sync-like ويُرجع حالة الجهاز:

```ts
export async function getLocalBootstrap(): Promise<{
  hasLocalData: boolean;
  familyId: string | null;
  profileName: string | null;
  isEmptyDevice: boolean;
}> {
  // 1. localStorage أسرع
  const cachedFamilyId = localStorage.getItem("cached_family_id");
  const cachedName = /* scan profile_name_* keys */;
  
  // 2. Dexie fallback
  const profile = await db.profiles.toCollection().first();
  const member = await db.family_members.toCollection().first();
  const familyId = cachedFamilyId || member?.family_id || null;
  const profileName = cachedName || profile?.name || null;
  
  // 3. فحص وجود بيانات فعلية
  const counts = await Promise.all([
    db.task_lists.count(),
    db.market_lists.count(),
    db.budgets.count(),
  ]);
  const hasLocalData = counts.some(c => c > 0) || !!member;
  
  return {
    hasLocalData,
    familyId,
    profileName,
    isEmptyDevice: !familyId && !hasLocalData,
  };
}
```

---

### الخطوة 3 — تعديل `src/hooks/useFamilyId.ts`

الترتيب الجديد:
1. `localStorage` (فوري، 0ms)
2. Dexie `family_members` (async لكن محلي)
3. فقط إذا كلاهما فارغ → `family-management` edge function

```ts
// إضافة initialData من Dexie
const [dexieFamilyId, setDexieFamilyId] = useState<string | null>(null);

useEffect(() => {
  if (cachedId || !user) return;
  db.family_members
    .where("user_id").equals(user.id)
    .first()
    .then(m => {
      if (m?.family_id) {
        setDexieFamilyId(m.family_id);
        localStorage.setItem("cached_family_id", m.family_id);
      }
    })
    .catch(() => {});
}, [user, cachedId]);

return {
  familyId: query.data?.family_id ?? cachedId ?? dexieFamilyId ?? null,
  isLoading: !cachedId && !dexieFamilyId && query.isLoading && !!user,
};
```

---

### الخطوة 4 — تعديل `src/contexts/AuthContext.tsx`

إذا وُجد بروفايل محلي (localStorage أو Dexie) → `profileReady = true` فوراً:

```ts
// في fetchProfile، قبل أي network call:
const cachedName = localStorage.getItem(`profile_name_${userId}`);
if (!cachedName) {
  // حاول Dexie
  const localProfile = await db.profiles.get(userId);
  if (localProfile?.name) {
    setProfileName(localProfile.name);
    setProfileReady(true);
    localStorage.setItem(`profile_name_${userId}`, localProfile.name);
  }
}
// ثم network fetch بالخلفية كالمعتاد
```

---

### الخطوة 5 — تعديل `src/components/AuthGuard.tsx`

فك حجز الدخول:
- إذا `cached_family_id` موجود أو Dexie فيها `family_members` → اسمح بالدخول فوراً
- لا تستدعِ `family-management` إلا إذا الجهاز فارغ محلياً
- إذا فارغ + لا إنترنت → رسالة واضحة بدل spinner لا نهائي

التعديل الأساسي: جعل `useEffect` الحالي يفحص Dexie أيضاً قبل استدعاء الشبكة:
```ts
// قبل استدعاء API:
const localMember = await db.family_members.toCollection().first();
if (localMember?.family_id) {
  localStorage.setItem("cached_family_id", localMember.family_id);
  localStorage.setItem("join_or_create_done", "true");
  setFamilyExists(true);
  setFamilyChecked(true);
  return;
}
// فقط هنا نلجأ للشبكة...
```

إضافة حالة "لا بيانات ولا إنترنت":
```ts
if (!navigator.onLine && !familyExists) {
  // عرض رسالة: "هذا الجهاز لا يحتوي بيانات، يحتاج اتصال أول مرة"
}
```

---

### الخطوة 6 — تعديل `src/hooks/useInitialSync.ts`

القرار يعتمد على Dexie لا على `first_sync_done` وحده:

- إذا Dexie فيها بيانات → لا blocking sync → دخول فوري + sync بالخلفية
- إذا Dexie فارغة + إنترنت → fullSync مع overlay
- إذا Dexie فارغة + لا إنترنت → حالة واضحة

```ts
const localCount = await db.task_lists.count() + await db.market_lists.count();
if (localCount > 0) {
  setState("done"); // عندنا بيانات محلية، لا حاجة لـ blocking
  // background delta sync فقط
  return;
}
// هنا فقط نعمل fullSync...
```

---

### الخطوة 7 — تعديل `src/components/FirstSyncOverlay.tsx`

- لا يظهر لمجرد غياب `first_sync_done`
- يظهر فقط إذا Dexie فارغة فعلاً (`isEmptyDevice`)
- إضافة حالة offline واضحة

---

### الخطوة 8 — تعديل `src/App.tsx` + `src/lib/warmCache.ts`

`WarmCacheProvider` يعمل من `familyId` المحلي (localStorage/Dexie) بدون انتظار الشبكة. إذا `familyId` متاح محلياً → `warmCache` ينطلق فوراً.

---

## ملخص الملفات

| الملف | التعديل |
|-------|---------|
| `src/contexts/AuthContext.tsx` | كتابة profile في Dexie + قراءة منها قبل الشبكة |
| `src/pages/CompleteProfile.tsx` | كتابة profile في Dexie بعد الحفظ |
| `src/pages/JoinOrCreate.tsx` | كتابة family + member في Dexie بعد create/join |
| `src/lib/localBootstrap.ts` | **جديد** — helper يقرأ حالة الجهاز من Dexie |
| `src/hooks/useFamilyId.ts` | إضافة Dexie كمصدر ثانٍ قبل الشبكة |
| `src/components/AuthGuard.tsx` | فحص Dexie قبل استدعاء family-management |
| `src/hooks/useInitialSync.ts` | قرار sync مبني على Dexie لا localStorage فقط |
| `src/components/FirstSyncOverlay.tsx` | يظهر فقط إذا الجهاز فارغ فعلاً |
| `src/App.tsx` | warmCache ينطلق من familyId المحلي |
| `src/lib/warmCache.ts` | لا تغيير جوهري، يعمل كما هو |

## المبدأ الأساسي

```text
المستخدم يفتح التطبيق
       ↓
Dexie فيها بيانات؟
  نعم → التطبيق يفتح فوراً + sync بالخلفية
  لا  → localStorage فيها family_id؟
         نعم → التطبيق يفتح + يجلب من API
         لا  → فيه إنترنت؟
                نعم → fullSync مع overlay
                لا  → رسالة "يحتاج اتصال أول مرة"
```

