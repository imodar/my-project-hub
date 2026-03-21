import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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

// Features visibility per role type
// parent: all features
// child: all features  
// staff: restricted
const STAFF_HIDDEN_FEATURES = ["/places", "/will"];
const STAFF_PERSONAL_ONLY_FEATURES = ["/albums"]; // personal scope only
const STAFF_DISABLED_FEATURES = ["/calendar"]; // disabled

export interface FeatureAccess {
  hidden: string[];
  personalOnly: string[];
  disabled: string[];
  isStaff: boolean;
  isParent: boolean;
}

interface UserRoleContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  featureAccess: FeatureAccess;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export const UserRoleProvider = ({ children }: { children: ReactNode }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem("current_user_role");
    return (saved as UserRole) || "father";
  });

  useEffect(() => {
    localStorage.setItem("current_user_role", currentRole);
  }, [currentRole]);

  const staff = isStaffRole(currentRole);
  const parent = isParentRole(currentRole);

  const featureAccess: FeatureAccess = {
    hidden: staff ? STAFF_HIDDEN_FEATURES : [],
    personalOnly: staff ? STAFF_PERSONAL_ONLY_FEATURES : [],
    disabled: staff ? STAFF_DISABLED_FEATURES : [],
    isStaff: staff,
    isParent: parent,
  };

  return (
    <UserRoleContext.Provider value={{ currentRole, setCurrentRole, featureAccess }}>
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = () => {
  const ctx = useContext(UserRoleContext);
  if (!ctx) throw new Error("useUserRole must be used within UserRoleProvider");
  return ctx;
};
