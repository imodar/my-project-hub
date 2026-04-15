import { useUserRole } from "@/contexts/UserRoleContext";
import { Navigate } from "react-router-dom";

/**
 * SECURITY: Blocks non-admin users from accessing admin panel routes.
 * Fail-closed: denies access while loading and when role is unknown.
 * Backend APIs already enforce admin checks, but this prevents UI
 * information disclosure to unauthorized users.
 */
const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, isLoading } = useUserRole();

  // Block rendering while role is loading — fail-closed
  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
