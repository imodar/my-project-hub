

# إصلاح المشاكل المتبقية — تم التنفيذ ✅

## 1. trash-api restore — 9 أنواع ناقصة ✅
أُضيف else if لكل نوع: document_list, place_list, trip (مع trip_packing), album, budget, debt (مع debt_payments + debt_postponements), medication, vehicle (مع vehicle_maintenance), calendar_event.

## 2. Trips.tsx localStorage → useAlbums ✅
استُبدل localStorage.getItem("family-albums") وdemo data بـ useAlbums() hook.

## 3. PullToRefresh × 8 صفحات → invalidateQueries ✅
Index, Will, Places, Documents, Tasks, Market, Vehicle, Albums — كلها تستدعي queryClient.invalidateQueries الآن.

## 4. usePlaceLists → useOfflineMutation ✅
createList, deleteList, addPlace, updatePlace, deletePlace محوّلة لـ useOfflineMutation مع useOfflineFirst.

## 5. Settings toggleMemberSOS → حذف ✅
أُزيل toggleMemberSOS وsosEnabled لأنه local state فقط.
