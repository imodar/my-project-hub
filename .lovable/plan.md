

# View Transitions API — خطة نهائية محدثة

## الملفات المتأثرة
1. `src/hooks/useAppNavigate.ts` — **جديد**
2. `src/components/PageTransition.tsx` — تبسيط
3. `src/index.css` — CSS للانتقالات
4. `src/components/home/BottomNav.tsx` — useAppNavigate + direction: "tab"
5. `src/components/home/FeatureGrid.tsx` — useAppNavigate
6. `src/components/home/IslamicQuickActions.tsx` — useAppNavigate
7. `src/components/home/DailyTasks.tsx` — useAppNavigate

---

## 1. إنشاء `src/hooks/useAppNavigate.ts`

```ts
import { useNavigate, NavigateOptions } from "react-router-dom";
import { flushSync } from "react-dom";

type NavDirection = "forward" | "back" | "tab";

export function useAppNavigate() {
  const navigate = useNavigate();
  return (to: string, options?: NavigateOptions & { direction?: NavDirection }) => {
    const dir = options?.direction ?? "forward";
    document.documentElement.dataset.navDirection = dir;

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        flushSync(() => navigate(to, options));
      });
    } else {
      navigate(to, options);
    }
  };
}
```

---

## 2. تبسيط `PageTransition.tsx`

حذف `framer-motion`، إرجاع children فقط:

```tsx
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

---

## 3. إضافة CSS في `index.css`

```css
/* === View Transitions === */

/* Tab = fade فقط (BottomNav) — الـ tabs "موجودة دائماً" */
[data-nav-direction="tab"] ::view-transition-new(root) {
  animation: 150ms ease-out both vt-fade-in;
}
[data-nav-direction="tab"] ::view-transition-old(root) {
  animation: 150ms ease-out both vt-fade-out;
}

/* Forward = صفحة جديدة تدخل من اليسار (RTL) — الصفحات "تُفتح" */
[data-nav-direction="forward"] ::view-transition-new(root) {
  animation: 200ms ease-out both vt-fade-in, 200ms ease-out both vt-slide-in-rtl;
}
[data-nav-direction="forward"] ::view-transition-old(root) {
  animation: 200ms ease-out both vt-fade-out, 200ms ease-out both vt-slide-out-rtl;
}

/* Back = صفحة ترجع من اليمين */
[data-nav-direction="back"] ::view-transition-new(root) {
  animation: 200ms ease-out both vt-fade-in, 200ms ease-out both vt-slide-in-ltr;
}
[data-nav-direction="back"] ::view-transition-old(root) {
  animation: 200ms ease-out both vt-fade-out, 200ms ease-out both vt-slide-out-ltr;
}

@keyframes vt-fade-in  { from { opacity: 0; } }
@keyframes vt-fade-out { to   { opacity: 0; } }
@keyframes vt-slide-in-rtl  { from { transform: translateX(-20px); } }
@keyframes vt-slide-out-rtl { to   { transform: translateX(20px); } }
@keyframes vt-slide-in-ltr  { from { transform: translateX(20px); } }
@keyframes vt-slide-out-ltr { to   { transform: translateX(-20px); } }
```

---

## 4. تحديث 4 ملفات

**BottomNav.tsx**: `useNavigate()` → `useAppNavigate()` مع `direction: "tab"`:
```ts
navigate(item.path, { direction: "tab" });
```

**FeatureGrid.tsx**: `useNavigate()` → `useAppNavigate()` — direction الافتراضي `"forward"`.

**IslamicQuickActions.tsx**: نفس الاستبدال — `"forward"` افتراضي.

**DailyTasks.tsx**: نفس الاستبدال — `"forward"` افتراضي.

---

## ما لا يتغير
- أزرار "رجوع" في PageHeader — تبقى `useNavigate` العادي، تُحدَّث تدريجياً لاحقاً بـ `{ direction: "back" }`
- `framer-motion` يبقى في المشروع (مستخدم في أماكن أخرى)
- الـ offline-first sync مستقل تماماً

## النتيجة
- Tab switching (BottomNav) = **fade سريع 150ms** — شعور أن الـ tabs موجودة دائماً
- Feature navigation (FeatureGrid/Islamic/Tasks) = **slide + fade 200ms** — شعور أن الصفحات تُفتح
- Back (مستقبلاً) = **slide معاكس** — شعور native

