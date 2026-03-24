import { useUserRole } from "@/contexts/UserRoleContext";
import { Navigate } from "react-router-dom";

interface RoleGuardProps {
  requireNonStaff?: boolean;
  children: React.ReactNode;
}

const RoleGuard = ({ requireNonStaff, children }: RoleGuardProps) => {
  const { dbRole, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (requireNonStaff && dbRole && ["worker", "maid", "driver"].includes(dbRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
