import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Permission } from "../../../shared/types/permissions";
import { useAuth } from "../../hooks/useAuth";
import { ErrorState, FullPageSpinner } from "../ui";

export function ProtectedRoute() {
  const { user, isLoading, error, refresh } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner label="Checking your session" />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <ErrorState
          title="Unable to verify your session"
          message="Check your connection and try again."
          onRetry={() => {
            void refresh();
          }}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner label="Loading" />;
  }

  if (user) {
    if (user.mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }

    const state = location.state as { from?: string } | null;
    const destination =
      state?.from && state.from.startsWith("/") && !state.from.startsWith("//")
        ? state.from
        : "/dashboard";

    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.permissions.includes(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
