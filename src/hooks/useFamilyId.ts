import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/db";

const CACHE_KEY = "cached_family_id";

interface FamilyIdData {
  family_id: string | null;
  pending_family_id: string | null;
}

export function useFamilyId() {
  const { user } = useAuth();

  // 1. Synchronous fallback from localStorage — available at 0ms
  const cachedId = user ? localStorage.getItem(CACHE_KEY) : null;

  // 2. Dexie fallback — async but local (no network)
  const [dexieFamilyId, setDexieFamilyId] = useState<string | null>(null);

  useEffect(() => {
    if (cachedId || !user) return;
    db.family_members
      .where("user_id")
      .equals(user.id)
      .first()
      .then((m: any) => {
        if (m?.family_id) {
          setDexieFamilyId(m.family_id);
          localStorage.setItem(CACHE_KEY, m.family_id);
        }
      })
      .catch(() => {});
  }, [user, cachedId]);

  // 3. Network — only if no local data
  const hasLocalFamilyId = !!(cachedId || dexieFamilyId);

  const query = useQuery({
    queryKey: ["family-id", user?.id],
    queryFn: async (): Promise<FamilyIdData> => {
      if (!user) return { family_id: null, pending_family_id: null };
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "get-family-id" },
      });
      if (error) throw error;
      const fid = data?.data?.family_id || null;
      const pendingFid = data?.data?.pending_family_id || null;
      // Cache for instant access on next visit
      if (fid) {
        localStorage.setItem(CACHE_KEY, fid);
        // Also write to Dexie if not there
        try {
          const existing = await db.family_members.where("user_id").equals(user.id).first();
          if (!existing && fid) {
            await db.family_members.put({
              id: crypto.randomUUID(),
              family_id: fid,
              user_id: user.id,
              status: "active",
            });
          }
        } catch {}
      } else {
        localStorage.removeItem(CACHE_KEY);
      }
      return { family_id: fid, pending_family_id: pendingFid };
    },
    enabled: !!user && !hasLocalFamilyId,
    staleTime: 30 * 60 * 1000, // 30 min
  });

  return {
    familyId: query.data?.family_id ?? cachedId ?? dexieFamilyId ?? null,
    pendingFamilyId: query.data?.pending_family_id ?? null,
    isLoading: !cachedId && !dexieFamilyId && query.isLoading && !!user,
  };
}
