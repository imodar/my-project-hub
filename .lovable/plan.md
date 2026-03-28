

# إصلاح التحميل الفوري — الخطة الكاملة النهائية (5 ملفات)

## التعديلات

### 1. `src/lib/warmCache.ts` — سطر 24
```ts
// قبل:
{ table: "vaccination_children", queryKeyPrefix: "vaccinations" },
// بعد:
{ table: "vaccinations", queryKeyPrefix: "vaccinations" },
```

### 2. `src/hooks/useDebts.ts` — سطر 11
```ts
// قبل:
const key = ["debts", user?.id];
// بعد:
const key = ["debts", familyId];
```

### 3. `src/hooks/useZakatAssets.ts`
- إضافة `import { useFamilyId } from "./useFamilyId"`
- إضافة `const { familyId } = useFamilyId()`
- تغيير key إلى `["zakat-assets", familyId]`
- تغيير `enabled: !!user && !!familyId`

### 4. `src/hooks/useWill.ts`
- إضافة `import { useFamilyId } from "./useFamilyId"`
- إضافة `const { familyId } = useFamilyId()`
- تغيير key إلى `["will", familyId]`
- تغيير `enabled: !!user && !!familyId`

### 5. `src/App.tsx` — WarmCacheProvider
```ts
const WarmCacheProvider = ({ children }: { children: React.ReactNode }) => {
  const { familyId, isLoading: familyLoading } = useFamilyId();
  const qc = useQueryClient();
  const warmedRef = useRef(false);
  const [cacheReady, setCacheReady] = useState(false);

  useFamilyRealtime();

  useEffect(() => {
    if (familyId && !warmedRef.current) {
      warmedRef.current = true;
      warmCache(qc, familyId).then(() => setCacheReady(true));
    } else if (!familyId && !familyLoading) {
      setCacheReady(true);
    }
  }, [familyId, familyLoading, qc]);

  // ... sync queue listener يبقى كما هو ...

  if (!cacheReady) return <FirstSyncOverlay />;
  return <>{children}</>;
};
```

ملاحظة: `FirstSyncOverlay` مستورد أصلاً في `App.tsx`. استخدامه هنا بدل `null` يمنع الشاشة البيضاء ويعرض overlay مناسب أثناء تجهيز الكاش.

---

## ملخص
- **5 ملفات** — تصحيح جدول، توحيد 3 queryKeys، معالجة race condition مع `<FirstSyncOverlay />` بدل شاشة بيضاء

