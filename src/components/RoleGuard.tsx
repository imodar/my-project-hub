import { useUserRole } from "@/contexts/UserRoleContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface RoleGuardProps {
  requireNonStaff?: boolean;
  children: React.ReactNode;
}

const RoleGuard = ({ requireNonStaff, children }: RoleGuardProps) => {
  const { dbRole, isLoading } = useUserRole();

  if (requireNonStaff) {
    if (isLoading || !dbRole) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (["worker", "maid", "driver"].includes(dbRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default RoleGuard;
