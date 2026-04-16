import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function adminCall(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-api", {
    body: { action, ...body },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => adminCall("dashboard-full"),
    staleTime: 60_000,
  });
}

export function useAdminUsers(page = 1, search = "") {
  return useQuery({
    queryKey: ["admin", "users", page, search],
    queryFn: () => adminCall("get-users", { page, limit: 20, search: search || undefined }),
  });
}

export function useAdminFamilies(page = 1, search = "") {
  return useQuery({
    queryKey: ["admin", "families", page, search],
    queryFn: () => adminCall("get-families", { page, limit: 20, search: search || undefined }),
  });
}

export function useAdminAuditLog(page = 1) {
  return useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: () => adminCall("get-audit-log", { page, limit: 50 }),
  });
}

export function useAdminNotifications(page = 1) {
  return useQuery({
    queryKey: ["admin", "notifications", page],
    queryFn: () => adminCall("get-notification-log", { page, limit: 50 }),
  });
}

export function useAdminSubscriptions() {
  return useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => adminCall("get-subscriptions"),
  });
}

export function useAdminContentStats() {
  return useQuery({
    queryKey: ["admin", "content-stats"],
    queryFn: () => adminCall("content-stats"),
    staleTime: 120_000,
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => adminCall("get-settings"),
  });
}

export function useAdminVersions() {
  return useQuery({
    queryKey: ["admin", "versions"],
    queryFn: () => adminCall("get-versions"),
  });
}

export function useAdminSecurity() {
  return useQuery({
    queryKey: ["admin", "security"],
    queryFn: () => adminCall("get-security"),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useAdminUserSubscription(userId: string) {
  return useQuery({
    queryKey: ["admin", "user-subscription", userId],
    queryFn: () => adminCall("get-user-subscription", { target_user_id: userId }),
    enabled: !!userId && userId.length > 10,
  });
}

export function useAdminMutations() {
  const qc = useQueryClient();

  const suspendUser = useMutation({
    mutationFn: (params: { target_user_id: string; reason?: string }) =>
      adminCall("suspend-user", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const unsuspendUser = useMutation({
    mutationFn: (params: { target_user_id: string }) =>
      adminCall("unsuspend-user", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const updateSetting = useMutation({
    mutationFn: (params: { key: string; value: unknown }) =>
      adminCall("update-setting", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
  });

  const addVersion = useMutation({
    mutationFn: (params: { version: string; release_notes?: string; force_update?: boolean; min_supported_version?: string; update_message?: string }) =>
      adminCall("add-version", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "versions"] }),
  });

  const sendBroadcast = useMutation({
    mutationFn: (params: { title: string; body: string }) =>
      adminCall("send-broadcast", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "notifications"] }),
  });

  const grantSubscription = useMutation({
    mutationFn: (params: { target_user_id: string; plan: string; expires_at?: string }) =>
      adminCall("grant-subscription", params),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["admin", "user-subscription", vars.target_user_id] });
    },
  });

  const revokeSubscription = useMutation({
    mutationFn: (params: { target_user_id: string }) =>
      adminCall("revoke-subscription", params),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["admin", "user-subscription", vars.target_user_id] });
    },
  });

  const syncRevenueCatCustomer = useMutation({
    mutationFn: (params: { target_user_id: string; revenuecat_customer_id: string }) =>
      adminCall("sync-revenuecat-customer", params),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "user-subscription", vars.target_user_id] });
    },
  });

  return {
    suspendUser,
    unsuspendUser,
    updateSetting,
    addVersion,
    sendBroadcast,
    grantSubscription,
    revokeSubscription,
    syncRevenueCatCustomer,
  };
}
