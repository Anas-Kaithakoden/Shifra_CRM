import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  FilterX,
  Plus,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import type { Role } from "../../shared/types/roles";
import { ROLE_LABELS } from "../../shared/types/roles";
import { PERMISSIONS } from "../../shared/types/permissions";
import {
  PASSWORD_MIN_LENGTH,
  checkPasswordPolicy,
} from "../../shared/constants/password";
import type { CreateEmployeeFormValues } from "../types/forms";
import type { AssignableRole } from "../types/forms";
import { useAuth } from "../hooks/useAuth";
import { useDebounce } from "../hooks/useDebounce";
import { useToast } from "../hooks/useToast";
import { usersService } from "../services/users.service";
import { ApiError } from "../lib/api";
import { assignableRolesFor, hasPermission } from "../lib/permissions";
import { formatDate, formatDateTime } from "../lib/format";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  PasswordInput,
  RoleBadge,
  Select,
  Skeleton,
  StatusBadge,
} from "../components/ui";

type StatusFilter = "active" | "inactive" | "";
type RoleFilter = Role | "";

interface CreateFieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  role?: string;
}

function CreateEmployeeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AssignableRole>("employee");
  const [fieldErrors, setFieldErrors] = useState<CreateFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const availableRoles = user
    ? assignableRolesFor(user).filter(
        (value): value is AssignableRole =>
          value === "admin" || value === "employee",
      )
    : [];

  useEffect(() => {
    if (!open) {
      return;
    }
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("employee");
    setFieldErrors({});
    setFormError(null);
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (input: CreateEmployeeFormValues) => usersService.create(input),
    onSuccess: (created) => {
      toast({
        title: "Employee created",
        description: `${created.fullName} must change the temporary password at first sign-in.`,
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const errors: CreateFieldErrors = {};
    if (fullName.trim().length < 2) {
      errors.fullName = "Enter at least 2 characters.";
    }
    if (!email.trim()) {
      errors.email = "Enter an email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    const passwordPolicy = checkPasswordPolicy(password);
    if (!passwordPolicy.valid) {
      errors.password = passwordPolicy.errors[0] ?? "Choose a stronger password.";
    }
    if (!availableRoles.includes(role)) {
      errors.role = "Choose a valid role.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      await createMutation.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (Array.isArray(error.details)) {
          const nextErrors: CreateFieldErrors = {};
          for (const detail of error.details) {
            if (
              detail &&
              typeof detail === "object" &&
              "path" in detail &&
              "message" in detail
            ) {
              const path = String(detail.path);
              const message = String(detail.message);
              if (path === "fullName" || path === "email" || path === "password" || path === "role") {
                nextErrors[path] = message;
              }
            }
          }
          if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            return;
          }
        }
        setFormError(error.message);
        return;
      }
      setFormError("Unable to create the employee right now. Please try again.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add employee"
      description="Create an account for a team member. They will be asked to change the temporary password after signing in."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-employee-form"
            isLoading={createMutation.isPending}
          >
            Create employee
          </Button>
        </>
      }
    >
      <form id="create-employee-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {formError}
          </div>
        ) : null}

        <Input
          label="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="e.g. Amina Yusuf"
          autoComplete="name"
          error={fieldErrors.fullName}
          required
        />

        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@shifranuha.com"
          autoComplete="email"
          error={fieldErrors.email}
          required
        />

        <PasswordInput
          label="Temporary password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 12 characters"
          autoComplete="new-password"
          error={fieldErrors.password}
          hint={`Minimum ${PASSWORD_MIN_LENGTH} characters with upper and lower case letters and a number.`}
          required
        />

        <Select
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as AssignableRole)}
          error={fieldErrors.role}
          hint={
            user?.role === "owner"
              ? "Admins can manage employees; employees can view the dashboard and their profile."
              : "Administrators can create employee accounts."
          }
          required
        >
          {availableRoles.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </Select>
      </form>
    </Modal>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function EmployeesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [role, setRole] = useState<RoleFilter>("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, role, status, pageSize]);

  const listQuery = useQuery({
    queryKey: [
      "users",
      "list",
      { page, pageSize, search: debouncedSearch, role, status },
    ],
    queryFn: () =>
      usersService.list({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        role: role || undefined,
        status: status || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (listQuery.data && page > Math.max(1, listQuery.data.pagination.totalPages)) {
      setPage(Math.max(1, listQuery.data.pagination.totalPages));
    }
  }, [listQuery.data, page]);

  const canCreate = hasPermission(user, PERMISSIONS.USERS_CREATE);
  const hasFilters = Boolean(search.trim() || role || status);
  const items = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;

  const clearFilters = () => {
    setSearch("");
    setRole("");
    setStatus("");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        description="Manage accounts, roles and access for your organization."
        actions={
          canCreate ? (
            <Button
              onClick={() => setCreateOpen(true)}
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Add employee
            </Button>
          ) : null
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="lg:max-w-sm lg:flex-1">
            <Input
              aria-label="Search employees"
              placeholder="Search by name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select
              aria-label="Filter by role"
              value={role}
              onChange={(event) => setRole(event.target.value as RoleFilter)}
              containerClassName="sm:w-36"
            >
              <option value="">All roles</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="employee">Employee</option>
            </Select>

            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              containerClassName="sm:w-36"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>

            <Select
              aria-label="Rows per page"
              value={String(pageSize)}
              onChange={(event) => setPageSize(Number(event.target.value))}
              containerClassName="col-span-2 sm:w-28"
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </Select>

            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                leftIcon={<FilterX className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {listQuery.isLoading ? (
          <TableSkeleton />
        ) : listQuery.isError ? (
          <div className="p-4">
            <ErrorState
              title="Unable to load employees"
              message="Please check your connection and try again."
              onRetry={() => {
                void listQuery.refetch();
              }}
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title={hasFilters ? "No employees match your filters" : "No employees yet"}
            description={
              hasFilters
                ? "Try a different search term or clear the filters."
                : "Add your first team member to start managing access."
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : canCreate ? (
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  leftIcon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
                >
                  Add employee
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Employee
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Last login
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Joined
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((employee) => (
                    <tr
                      key={employee.id}
                      className="group transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/employees/${employee.id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar name={employee.fullName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800 group-hover:text-brand-800">
                              {employee.fullName}
                              {employee.id === user?.id ? (
                                <span className="ml-1.5 text-xs font-normal text-slate-400">
                                  (you)
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {employee.email}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={employee.role} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge active={employee.isActive} />
                          {employee.mustChangePassword ? (
                            <Badge variant="warning">Password change due</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDateTime(employee.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(employee.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/employees/${employee.id}`)}
                          className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          aria-label={`Open ${employee.fullName}`}
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((employee) => (
                <li key={employee.id}>
                  <Link
                    to={`/employees/${employee.id}`}
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50"
                  >
                    <Avatar name={employee.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {employee.fullName}
                        {employee.id === user?.id ? (
                          <span className="ml-1 text-xs font-normal text-slate-400">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {employee.email}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <RoleBadge role={employee.role} />
                        <StatusBadge active={employee.isActive} />
                      </div>
                    </div>
                    <ChevronRight
                      className="mt-1 h-4 w-4 shrink-0 text-slate-300"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>

            {pagination ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>

      <p className="text-xs text-slate-400">
        {listQuery.isFetching && !listQuery.isLoading
          ? "Refreshing employee list…"
          : "Role and status changes are recorded in the audit log."}
      </p>

      {canCreate ? (
        <CreateEmployeeDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
    </div>
  );
}
