import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyId } from "./useFamilyId";
import { db } from "@/lib/db";

interface MemberLocation {
  user_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  updated_at: string;
  is_sharing: boolean;
  name: string;
  avatar_url: string | null;
  role: string;
  isMe: boolean;
}

export function useLocationTracking(intervalMinutes = 5) {
  const { familyId } = useFamilyId();
  const queryClient = useQueryClient();
  // null = لم نعرف بعد من السيرفر، true/false = محدّد
  const [isSharing, setIsSharingState] = useState<boolean | null>(null);
  const isSharingRef = useRef<boolean>(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendMyLocationRef = useRef<() => Promise<void>>(async () => {});

  // تحميل آخر مواقع محفوظة من Dexie فوراً (initialData)
  const cachedLocations = useRef<MemberLocation[]>([]);
  useEffect(() => {
    if (!familyId) return;
    db.member_locations
      .where("family_id").equals(familyId)
      .toArray()
      .then((rows) => { cachedLocations.current = rows as MemberLocation[]; });
  }, [familyId]);

  // جلب مواقع العائلة من السيرفر
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["family-locations", familyId],
    queryFn: async (): Promise<MemberLocation[]> => {
      if (!familyId) return [];
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return [];

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/location-api?action=list&familyId=${familyId}`,
        {
          headers: {
            authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch locations");
      const data: MemberLocation[] = await res.json();

      // حفظ المواقع في Dexie لعرضها فوراً في المرة القادمة
      if (data.length > 0) {
        await db.member_locations.bulkPut(
          data.map((l) => ({ ...l, family_id: familyId }))
        );
      }

      return data;
    },
    enabled: !!familyId,
    refetchInterval: intervalMinutes * 60 * 1000,
    staleTime: 60 * 1000,
    // عرض الكاش المحلي فوراً ريثما يحمّل السيرفر
    placeholderData: cachedLocations.current.length > 0 ? cachedLocations.current : undefined,
  });

  // تحديد isSharing من بيانات السيرفر (موقعي الخاص)
  useEffect(() => {
    if (locations.length === 0 || isSharing !== null) return;
    const me = locations.find((l) => l.isMe);
    if (me !== undefined) {
      setIsSharingState(me.is_sharing);
      isSharingRef.current = me.is_sharing;
    }
  }, [locations, isSharing]);

  // تزامن الـ ref مع الـ state
  useEffect(() => {
    if (isSharing !== null) isSharingRef.current = isSharing;
  }, [isSharing]);

  // تحديث موقعي
  const updateMutation = useMutation({
    mutationFn: async (coords: { lat: number; lng: number; accuracy?: number }) => {
      if (!familyId) throw new Error("No family");
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/location-api?action=update`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lat: coords.lat,
            lng: coords.lng,
            accuracy: coords.accuracy,
            familyId,
            isSharing: isSharingRef.current,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to update location");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-locations"] });
    },
    onError: (err) => {
      console.warn("[LocationTracking] Update failed:", err);
    },
  });

  // تبديل المشاركة وإرسالها فوراً للسيرفر
  const setIsSharing = useCallback(async (newVal: boolean) => {
    setIsSharingState(newVal);
    isSharingRef.current = newVal;
    if (!familyId) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      let lat = 0, lng = 0;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, timeout: 5000, maximumAge: 300000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        const me = locations.find((l) => l.isMe);
        if (me) { lat = me.lat; lng = me.lng; }
      }

      await fetch(
        `https://${projectId}.supabase.co/functions/v1/location-api?action=update`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lat, lng, familyId, isSharing: newVal }),
        }
      );
      queryClient.invalidateQueries({ queryKey: ["family-locations"] });
    } catch (err) {
      console.warn("[LocationTracking] Toggle sharing failed:", err);
    }
  }, [familyId, locations, queryClient]);

  // إرسال موقعي الحالي
  const sendMyLocation = useCallback(async () => {
    if (!isSharingRef.current || !familyId) return;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        });
      });
      updateMutation.mutate({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } catch (err) {
      console.warn("Location error:", err);
    }
  }, [familyId, updateMutation]);

  useEffect(() => {
    sendMyLocationRef.current = sendMyLocation;
  }, [sendMyLocation]);

  // تتبع دوري للموقع
  useEffect(() => {
    if (isSharing !== true || !familyId) return;

    sendMyLocationRef.current();
    intervalRef.current = setInterval(
      () => sendMyLocationRef.current(),
      intervalMinutes * 60 * 1000
    );
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSharing, familyId, intervalMinutes]);

  // الحالة الافتراضية قبل تحديد السيرفر: true (لتبدأ المتابعة إذا لم يُوجد بيانات سيرفر بعد)
  const effectiveSharing = isSharing ?? true;

  return {
    locations,
    isLoading,
    isSharing: effectiveSharing,
    setIsSharing,
    sendMyLocation,
    isSending: updateMutation.isPending,
  };
}
