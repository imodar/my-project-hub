import { useUserRole } from "@/contexts/UserRoleContext";
import { Navigate } from "react-router-dom";

interface RoleGuardProps {
  requireNonStaff?: boolean;
  children: React.ReactNode;
}

const RoleGuard = ({ requireNonStaff, children }: RoleGuardProps) => {
  const { dbRole, isLoading } = useUserRole();

  // SECURITY: Block rendering while role is loading to prevent unauthorized content flash.
  // Staff users must NEVER see protected content, even momentarily.
  if (requireNonStaff && isLoading) {
    return null;
  }

  if (requireNonStaff && dbRole && ["worker", "maid", "driver"].includes(dbRole)) {
    return <Navigate to="/" replace />;
  }

  // SECURITY: If role is null after loading, deny access (fail-closed).
  if (requireNonStaff && !isLoading && !dbRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
