import { useUserRole } from "@/contexts/UserRoleContext";
import { Navigate } from "react-router-dom";

interface RoleGuardProps {
  requireNonStaff?: boolean;
  children: React.ReactNode;
}

const RoleGuard = ({ requireNonStaff, children }: RoleGuardProps) => {
  const { dbRole, isLoading } = useUserRole();

  // Show children immediately — don't block with spinner
  // Only redirect once role is confirmed as staff
  if (requireNonStaff && !isLoading && dbRole && ["worker", "maid", "driver"].includes(dbRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
