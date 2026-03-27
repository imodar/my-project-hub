

# Fix: Market list creation duplicates and missing properties

## Root Causes

### 1. Duplicate lists in header
`createList` mutation passes `queryKey: key` which triggers **optimistic INSERT** (adds entry with client-generated UUID to cache). Then `onSuccess: () => refetch()` fetches from server which returns the **real** entry with a different server-generated UUID. Result: two entries with different IDs but same name.

### 2. `use_categories` not sent to server
- `useMarketLists.ts` line 65: `apiFn` only sends `name` and `type` — missing `use_categories`
- `market-api/index.ts` `create-list`: doesn't read or insert `use_categories`
- So server always defaults to `use_categories: true`, ignoring user's choice

### 3. Wrong list survives after refresh
Optimistic entry has `use_categories` from user input (e.g., `false`). Server entry has `use_categories: true` (DB default). After refresh, only server data remains — so the correct settings are lost.

### 4. New list doesn't auto-select
The `onSuccess` callback path works but the optimistic entry arrives first and auto-select picks the first list, not the new one.

## Changes

### File 1: `src/hooks/useMarketLists.ts`
- **Remove `queryKey: key`** from `createList` mutation — this prevents optimistic INSERT, eliminating the duplicate. The `onSuccess: () => refetch()` already handles adding the real data.
- **Pass `use_categories`** in the `apiFn` to the server

### File 2: `supabase/functions/market-api/index.ts`
- In `create-list` action: read `use_categories` from body and include it in the INSERT

### File 3: `src/pages/Market.tsx`
- No changes needed — the `onSuccess` callback already handles `setActiveListId(data.id)`, which will work once the duplicate issue is fixed

## Summary
| Problem | Fix |
|---|---|
| Two lists appear | Remove `queryKey` from createList mutation |
| `use_categories` ignored | Pass it through hook → API → DB |
| Wrong list after refresh | Fixed by sending `use_categories` to server |
| List doesn't auto-open | Fixed by removing optimistic duplicate race |

