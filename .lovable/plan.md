

# إصلاح: تأخر ظهور أفراد العائلة في الخريطة

## المشكلة
`useFamilyMembers` يقرأ من Dexie عبر `useEffect` + `useState` → أول render يكون `members = []` → المستخدم يشوف القائمة فاضية لـ 50-100ms قبل ما تمتلئ.

## الحل
استبدال `useEffect` + `useState` بـ `useLiveQuery` من Dexie — يعطي البيانات من أول render مباشرة (synchronous-like).

## التغييرات

### ملف: `src/hooks/useFamilyMembers.ts`

**قبل:**
```typescript
const [localMembers, setLocalMembers] = useState<FamilyMemberInfo[]>([]);

useEffect(() => {
  // async Dexie read → setState → re-render
}, [familyId, user?.id, excludeSelf]);
```

**بعد:**
```typescript
import { useLiveQuery } from "dexie-react-hooks";

const localMembers = useLiveQuery(async () => {
  if (!familyId) return [];
  const members = await db.family_members
    .where("family_id").equals(familyId)
    .toArray();
  if (members.length === 0) return [];
  
  const enriched = await Promise.all(
    members.map(async (m) => {
      const profile = await db.profiles.get(m.user_id).catch(() => null);
      return {
        id: m.user_id,
        name: profile?.name || ROLE_LABELS[m.role] || "عضو",
        role: m.role || "member",
        isAdmin: m.is_admin || false,
        isCreator: false,
        roleConfirmed: m.role_confirmed ?? true,
        status: m.status || "active",
      } as FamilyMemberInfo;
    })
  );
  
  if (excludeSelf && user) {
    return enriched.filter((m) => m.id !== user.id);
  }
  return enriched;
}, [familyId, user?.id, excludeSelf], []);  // [] = default value
```

- `useLiveQuery` يعيد النتيجة من Dexie فوراً (أو الـ default `[]` في أول frame ثم البيانات الحقيقية).
- كمان يتابع التغييرات في Dexie تلقائياً (reactive) — لو تحدثت البيانات المحلية، الواجهة تتحدث فوراً.
- حذف الـ `useState` و `useEffect` بالكامل.

## الملفات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `src/hooks/useFamilyMembers.ts` | استبدال useEffect+useState بـ useLiveQuery |

**ملف واحد، تغيير بسيط، بدون dependencies جديدة** (dexie-react-hooks موجود أصلاً في المشروع — يُستخدم في SyncStatus.tsx)

