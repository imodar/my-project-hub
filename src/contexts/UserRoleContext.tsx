import React, { createContext, useContext, useState, ReactNode } from "react";
import { useMyRole } from "@/hooks/useMyRole";

export type UserRole = "father" | "mother" | "husband" | "wife" | "son" | "daughter" | "worker" | "maid" | "driver";

export const isParentRole = (role: UserRole) =>
  role === "father" || role === "mother" || role === "husband" || role === "wife";

export const isStaffRole = (role: UserRole) =>
  role === "worker" || role === "maid" || role === "driver";

export const STAFF_ROLE_LABELS: Record<string, string> = {
  worker: "عامل",
  maid: "عاملة",
  driver: "سائق",
};

export const ROLE_LABELS: Record<string, string> = {
  father: "أب",
  mother: "أم",
  husband: "زوج",
  wife: "زوجة",
  son: "ابن",
  daughter: "ابنة",
  worker: "عامل",
  maid: "عاملة",
  driver: "سائق",
};

const STAFF_HIDDEN_FEATURES = ["/places", "/will", "/calendar", "/zakat", "/albums"];
const STAFF_PERSONAL_ONLY_FEATURES: string[] = [];
const STAFF_DISABLED_FEATURES: string[] = [];

export interface FeatureAccess {
  hidden: string[];
  personalOnly: string[];
  disabled: string[];
  isStaff: boolean;
  isParent: boolean;
}

interface UserRoleContextType {
  featureAccess: FeatureAccess;
  dbRole: UserRole | null;
  isAdmin: boolean;
  isLoading: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export const UserRoleProvider = ({ children }: { children: ReactNode }) => {
  const { dbRole, isAdmin, isLoading } = useMyRole();

  const staff = dbRole ? isStaffRole(dbRole) : false;
  const parent = dbRole ? isParentRole(dbRole) : true;

  const featureAccess: FeatureAccess = {
    hidden: staff ? STAFF_HIDDEN_FEATURES : [],
    personalOnly: staff ? STAFF_PERSONAL_ONLY_FEATURES : [],
    disabled: staff ? STAFF_DISABLED_FEATURES : [],
    isStaff: staff,
    isParent: parent,
  };

  return (
    <UserRoleContext.Provider value={{ featureAccess, dbRole, isAdmin, isLoading }}>
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = () => {
  const ctx = useContext(UserRoleContext);
  if (!ctx) throw new Error("useUserRole must be used within UserRoleProvider");
  return ctx;
};
