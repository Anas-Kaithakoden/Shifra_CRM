import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PERMISSIONS } from "../shared/types/permissions";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RequirePermission,
} from "./components/auth/RouteGuards";
import { AppLayout } from "./components/layout/AppLayout";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { CustomersPage } from "./pages/CustomersPage";
import { CustomerRenewalsPage } from "./pages/CustomerRenewalsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmployeeDetailPage } from "./pages/EmployeeDetailPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { FollowUpsPage } from "./pages/FollowUpsPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LeadDetailPage } from "./pages/LeadDetailPage";
import { LeadPipelinePage } from "./pages/LeadPipelinePage";
import { LeadsPage } from "./pages/LeadsPage";
import { LoginPage } from "./pages/LoginPage";
import { MyTasksPage } from "./pages/MyTasksPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { NotificationSettingsPage } from "./pages/NotificationSettingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TaskFollowUpsPage } from "./pages/TaskFollowUpsPage";
import { TasksPage } from "./pages/TasksPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route
              path="/leads"
              element={
                <RequirePermission permission={PERMISSIONS.LEADS_READ}>
                  <LeadsPage />
                </RequirePermission>
              }
            />
            <Route
              path="/leads/my"
              element={
                <RequirePermission permission={PERMISSIONS.LEADS_READ}>
                  <LeadsPage initialQuickFilter="my_leads" />
                </RequirePermission>
              }
            />
            <Route
              path="/leads/pipeline"
              element={
                <RequirePermission permission={PERMISSIONS.LEADS_READ}>
                  <LeadPipelinePage />
                </RequirePermission>
              }
            />
            <Route
              path="/leads/:id"
              element={
                <RequirePermission permission={PERMISSIONS.LEADS_READ}>
                  <LeadDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="/follow-ups"
              element={
                <RequirePermission permission={PERMISSIONS.FOLLOWUPS_READ}>
                  <FollowUpsPage />
                </RequirePermission>
              }
            />

            <Route
              path="/customers"
              element={
                <RequirePermission permission={PERMISSIONS.CUSTOMERS_READ}>
                  <CustomersPage />
                </RequirePermission>
              }
            />
            <Route
              path="/customers/renewals"
              element={
                <RequirePermission permission={PERMISSIONS.CUSTOMERS_READ}>
                  <CustomerRenewalsPage />
                </RequirePermission>
              }
            />
            <Route
              path="/customers/:id"
              element={
                <RequirePermission permission={PERMISSIONS.CUSTOMERS_READ}>
                  <CustomerDetailPage />
                </RequirePermission>
              }
            />

            <Route
              path="/employees"
              element={
                <RequirePermission permission={PERMISSIONS.USERS_READ}>
                  <EmployeesPage />
                </RequirePermission>
              }
            />
            <Route
              path="/employees/:id"
              element={
                <RequirePermission permission={PERMISSIONS.USERS_READ}>
                  <EmployeeDetailPage />
                </RequirePermission>
              }
            />

            <Route
              path="/audit-logs"
              element={
                <RequirePermission permission={PERMISSIONS.AUDIT_READ}>
                  <AuditLogsPage />
                </RequirePermission>
              }
            />

            <Route
              path="/settings"
              element={
                <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                  <SettingsPage />
                </RequirePermission>
              }
            />
            <Route
              path="/settings/notifications"
              element={
                <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                  <NotificationSettingsPage />
                </RequirePermission>
              }
            />

            <Route
              path="/tasks"
              element={
                <RequirePermission permission={PERMISSIONS.TASKS_READ}>
                  <TasksPage />
                </RequirePermission>
              }
            />
            <Route
              path="/tasks/my"
              element={
                <RequirePermission permission={PERMISSIONS.TASKS_READ}>
                  <MyTasksPage />
                </RequirePermission>
              }
            />
            <Route
              path="/tasks/follow-ups"
              element={
                <RequirePermission permission={PERMISSIONS.TASKS_READ}>
                  <TaskFollowUpsPage />
                </RequirePermission>
              }
            />

            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/forbidden" element={<ForbiddenPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
