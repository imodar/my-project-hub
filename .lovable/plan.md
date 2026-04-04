

# Fix: Private Storage Buckets Accessible by Any Authenticated User

## Problem
9 overly-broad storage policies on `album-photos`, `documents`, and `trip-documents` allow any authenticated user to read, upload, and delete files without family membership checks. Because Supabase evaluates PERMISSIVE policies with OR logic, these broad policies override the correctly-scoped "Family members access ..." ALL policies.

## Solution
One migration that drops all 9 broad policies. The existing well-scoped ALL policies already cover SELECT, INSERT, UPDATE, and DELETE with proper `is_family_member()` validation.

## Migration SQL

```sql
-- Drop overly-broad SELECT policies (no family check)
DROP POLICY IF EXISTS "Family members can read album photos" ON storage.objects;
DROP POLICY IF EXISTS "Family members can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Family members can read trip documents" ON storage.objects;

-- Drop overly-broad DELETE policies
DROP POLICY IF EXISTS "Authenticated can delete album photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete trip documents" ON storage.objects;

-- Drop overly-broad INSERT policies
DROP POLICY IF EXISTS "Authenticated can upload album photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload trip documents" ON storage.objects;
```

## What remains after cleanup
These correctly-scoped ALL policies stay in place:
- **"Family members access documents"** — validates `is_family_member(auth.uid(), folder_family_id)`
- **"Family members access album photos"** — validates family membership + not staff
- **"Family members access trip documents"** — validates family membership

## Files
| # | File | Change |
|---|------|--------|
| 1 | New migration | Drop 9 broad storage policies |

No code changes needed. Migration only.

