import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SubscriptionState {
  isSubscribed: boolean;
  plan: string;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  isGracePeriod: boolean;
  isLoading: boolean;
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.functions.invoke("auth-management", {
    body: { action: "get-profile" },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

export function useSubscription() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const plan: string = profile?.subscription_plan ?? "free";
  const expiresAt: string | null = profile?.subscription_expires_at ?? null;

  const now = new Date();
  const expiryDate = expiresAt ? new Date(expiresAt) : null;

  // Grace period: 3 days after expiry (configurable, but we use 3 as default here)
  const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
  const isInGrace = expiryDate
    ? expiryDate < now && now.getTime() - expiryDate.getTime() < GRACE_MS
    : false;

  const isSubscribed =
    plan !== "free" &&
    expiryDate !== null &&
    (expiryDate > now || isInGrace);

  const daysUntilExpiry = expiryDate
    ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Refresh subscription state (call after purchase webhook has time to propagate)
  const refreshSubscription = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["profile", user?.id] });
  }, [qc, user?.id]);

  return {
    isSubscribed,
    plan,
    expiresAt,
    daysUntilExpiry,
    isGracePeriod: isInGrace,
    isLoading,
    refreshSubscription,
    revenuecatCustomerId: profile?.revenuecat_customer_id ?? null,
  } satisfies SubscriptionState & {
    refreshSubscription: () => void;
    revenuecatCustomerId: string | null;
  };
}
