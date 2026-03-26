import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyId } from "./useFamilyId";

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
  const [isSharing, setIsSharingState] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendMyLocationRef = useRef<() => Promise<void>>(async () => {});

  // Fetch family locations
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
      return res.json();
    },
    enabled: !!familyId,
    refetchInterval: intervalMinutes * 60 * 1000,
    staleTime: 60 * 1000,
  });

  // Update my location
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
            isSharing,
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

  // Toggle sharing and immediately notify server
  const setIsSharing = useCallback(async (newVal: boolean) => {
    setIsSharingState(newVal);
    if (!familyId) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      // Get last known position or use 0,0 as fallback
      let lat = 0, lng = 0;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, timeout: 5000, maximumAge: 300000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* use last known from locations */ 
        const me = locations.find(l => l.isMe);
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

  // Get current position and send
  const sendMyLocation = useCallback(async () => {
    if (!isSharing || !familyId) return;
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
  }, [isSharing, familyId, updateMutation]);

  // Keep ref in sync
  useEffect(() => {
    sendMyLocationRef.current = sendMyLocation;
  }, [sendMyLocation]);

  // Start periodic tracking
  useEffect(() => {
    if (!isSharing || !familyId) return;

    sendMyLocationRef.current();

    intervalRef.current = setInterval(
      () => sendMyLocationRef.current(),
      intervalMinutes * 60 * 1000
    );

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSharing, familyId, intervalMinutes]);

  return {
    locations,
    isLoading,
    isSharing,
    setIsSharing,
    sendMyLocation,
    isSending: updateMutation.isPending,
  };
}
