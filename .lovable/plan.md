

# Implementation Plan: Post-Login Onboarding + Remove Deep Links

## Overview
After first login, new users see a "Join or Create Family" screen. The `/join` deep link route is removed entirely. Joining is instant (active status). AuthGuard uses synchronous localStorage check only.

## Verification Scenarios (from user's notes)
1. **Existing user, new device**: no `cached_family_id` → sees JoinOrCreate → `useFamilyId()` loads → finds family → sets flag → redirects to `/`
2. **New user skips**: sets `join_or_create_done=true` → lands on `/` → `/family` shows inline join+create UI
3. **signOut then re-login**: flag cleared → goes through JoinOrCreate again

## Changes

### 1. Create `src/pages/JoinOrCreate.tsx`
- Public route, self-checks auth via `useAuth()` — redirect to `/auth` if no session
- Calls `useFamilyId()` internally — if family already exists, sets `join_or_create_done=true` and redirects to `/`
- Visual style matches Auth page (gradient top, white bottom sheet, RTL)
- Three options:
  - **Code input**: 8-char field → edge function `action: "join"` → instant success toast → set flag + invalidate `family-id` → navigate `/`
  - **QR scan**: Camera with BarcodeDetector (same logic as FamilyManagement scanner) → same join flow
  - **Skip**: sets flag → navigate `/`

### 2. Edit `src/components/AuthGuard.tsx`
After session confirmed, add synchronous check (no hooks/queries):
```tsx
const joinDone = localStorage.getItem("join_or_create_done");
const cachedFamilyId = localStorage.getItem("cached_family_id");
if (!joinDone) {
  if (cachedFamilyId) {
    localStorage.setItem("join_or_create_done", "true");
  } else {
    return <Navigate to="/join-or-create" replace />;
  }
}
```

### 3. Edit `src/App.tsx`
- Add public route: `<Route path="/join-or-create" element={<JoinOrCreate />} />`
- Remove `/join` route and `JoinFamily` import

### 4. Edit `src/pages/Auth.tsx`
- Remove `pending_invite_code` logic (lines 29-35). After login just navigate to `/`.

### 5. Edit `src/pages/FamilyManagement.tsx`
- **Remove** auto-open `useEffect` (lines 115-119)
- **Remove** invite link section (lines 552-568), `handleCopyLink`, `handleShareLink`, `linkCopied` state
- **Update** `QrPattern` to encode raw invite code (not URL)
- **Update** share in add-member drawer to share code-only text (no URL)
- **Update** `handleJoinByCode` toast: "تم الانضمام بنجاح" + invalidate queries
- **When `!familyId`**: render inline UI (code input + QR scan + divider + create button) instead of auto-drawer
- **Remove** dead approval drawer (lines 816-924) and related state

### 6. Edit `src/contexts/AuthContext.tsx`
- Add `localStorage.removeItem("join_or_create_done")` to signOut (after line 124)

### 7. Delete `src/pages/JoinFamily.tsx`

## Files
| Action | File |
|--------|------|
| Create | `src/pages/JoinOrCreate.tsx` |
| Edit | `src/components/AuthGuard.tsx` |
| Edit | `src/App.tsx` |
| Edit | `src/pages/Auth.tsx` |
| Edit | `src/pages/FamilyManagement.tsx` |
| Edit | `src/contexts/AuthContext.tsx` |
| Delete | `src/pages/JoinFamily.tsx` |

