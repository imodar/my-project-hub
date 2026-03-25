

# Plan: Create Family Flow, Join Notifications, Role Confirmation, Role Warning

## Overview
Four interconnected changes: animated "Create Family" flow in JoinOrCreate, push notifications when someone joins, role confirmation tracking with admin approval drawer, and a dismissible role warning banner.

## Migration

Add `role_confirmed` column to `family_members`:

```sql
ALTER TABLE family_members ADD COLUMN role_confirmed boolean NOT NULL DEFAULT false;
```

Existing members (created via "create" action) should have `role_confirmed = true` — handle this in the edge function: set `role_confirmed: true` when creating family, `false` when joining via code.

## Changes

### 1. Edit `src/pages/JoinOrCreate.tsx` — Animated Create Flow

Add state: `showCreate` (boolean), `createRole` (role selection).

When "إنشاء عائلتي" tapped:
- Set `showCreate = true`
- Join section gets CSS class: `opacity-0 -translate-y-5 transition-all duration-300`
- Role grid fades in with 150ms delay: `opacity-1 translate-y-0`
- Skip button text changes to "إنشاء العائلة" (disabled until role selected)

Role grid: 4 boxes (father/mother/son/daughter) — same style as FamilyManagement setup drawer.

Info card below grid (CSS transition 200ms):
- Parent role: "ستكون المشرف الرئيسي..." text
- Child role: "ستكون المشرف المؤقت..." text

"إنشاء العائلة" button → calls edge function `action: "create"` with selected role → sets `join_or_create_done=true` → invalidates queries → navigates `/`.

**No Framer Motion** — pure CSS transitions via conditional classes + `transition-all duration-300`.

### 2. Edit `supabase/functions/family-management/index.ts` — Notifications on Join

In `action: "join"`:
- After successful insert, set `role_confirmed: false` in the insert
- Fetch joiner's profile name from `profiles` table
- Fetch all admin user_ids for that family (`family_members` where `is_admin = true`)
- Insert into `user_notifications` for each admin:
  - `type: "new_member"`, `title: "طلب انضمام جديد"`, `body: "${name} انضم للعائلة — تحقق من دوره"`, `source_type: "family_member"`, `source_id: family.id`

In `action: "create"`:
- Set `role_confirmed: true` in the member insert (creator confirms their own role)

Add new action `"confirm-role"`:
- Requires admin authorization (same pattern as toggle-admin)
- Updates `family_members` SET `role = body.role, role_confirmed = true` WHERE `family_id` AND `user_id = target_user_id`
- Inserts notification to the target user: "تم تأكيد انضمامك"

### 3. Edit `src/pages/FamilyManagement.tsx`

**A. Role Warning Banner** (above member list, for admins only):
- Show when `isMyAdmin && members.length > 1 && !localStorage.getItem("role_warning_dismissed_" + familyId)`
- Yellow/amber card with text: "⚠️ في حال اختيار دور خاطئ لأي عضو، يجب إزالته وإعادة دعوته لتصحيح الدور."
- Dismiss button (X) → sets localStorage key

**B. Unconfirmed Member Indicator**:
- `useFamilyMembers` needs to also return `roleConfirmed` from the query
- Members with `role_confirmed = false` show a badge: "تأكيد الدور" in amber, next to their role label
- Tapping the badge opens the role confirmation drawer

**C. Role Confirmation Drawer** (replaces old approval concept):
- Header: "${memberName} — تأكيد الدور"
- Shows member avatar + name (from profile)
- Role grid: all 9 roles (father/mother/husband/wife/son/daughter/worker/maid/driver)
- Pre-selects current role
- Confirm button → calls edge function `action: "confirm-role"` → refetch members

**D. Remove** the old `addStep === "enter-name"` step entirely — the add-member flow goes straight to `invite-method` (already does this via `handleAddMember`). Remove the `choose-type` step and `enter-name` step UI. The drawer only shows invite sharing options.

### 4. Edit `src/hooks/useFamilyMembers.ts`

Add `role_confirmed` to the select query and `FamilyMemberInfo` interface:
```ts
interface FamilyMemberInfo {
  // ... existing
  roleConfirmed: boolean;
}
```
Query: add `role_confirmed` to the `.select()` on `family_members`.

## Files

| Action | File |
|--------|------|
| Migration | Add `role_confirmed` to `family_members` |
| Edit | `src/pages/JoinOrCreate.tsx` |
| Edit | `supabase/functions/family-management/index.ts` |
| Edit | `src/pages/FamilyManagement.tsx` |
| Edit | `src/hooks/useFamilyMembers.ts` |

