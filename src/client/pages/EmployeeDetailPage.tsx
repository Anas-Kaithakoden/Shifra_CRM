import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  KeyRound,
  Lock,
  Mail,
  Pencil,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import type { AssignableRole } from "../types/forms";
import { ROLE_LABELS } from "../../shared/types/roles";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { usersService } from "../services/users.service";
import { ApiError } from "../lib/api";
import { canChangeUserRole, canManageUser } from "../lib/permissions";
import { formatDate, formatDateTime } from "../lib/format";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  Input,
  PageHeader,
  RoleBadge,
  Select,
  Skeleton,
  StatusBadge,
} from "../components/ui";

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AssignableRole>("employee");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["users", "detail", id],
    queryFn: () => usersService.get(id ?? ""),
    enabled: Boolean(id),
    retry: false,
  });

  const target = detailQuery.data;

  useEffect(() => {
    if (!target) {
      return;
    }
    setFullName(target.fullName);
    setRole(target.role === "admin" ? "admin" : "employee");
    setFormError(null);
  }, [target]);

  const updateMutation = useMutation({
    mutationFn: (updates: { fullName?: string; role?: AssignableRole }) =>
      usersService.update(target?.id ?? "", updates),
    onSuccess: (updated) => {
      toast({
        title: "Employee updated",
        description: `${updated.fullName}'s account details were saved.`,
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setFormError(null);
    },
  });

  const activeMutation = useMutation({
    mutationFn: (active: boolean) =>
      usersService.setActive(target?.id ?? "", active),
    onSuccess: (updated) => {
      toast({
        title: updated.isActive ? "Employee activated" : "Employee deactivated",
        description: updated.isActive
          ? `${updated.fullName} can sign in again.`
          : `${updated.fullName} has been signed out and blocked from signing in.`,
        variant: "success",
      });
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      setConfirmOpen(false);
      toast({
        title: "Unable to change account access",
        description:
          error instanceof ApiError
            ? error.message
            : "Please try again in a moment.",
        variant: "error",
      });
    },
  });

  if (detailQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (detailQuery.isError || !target) {
    const notFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404;
    return (
      <div className="space-y-4">
        <Link
          to="/employees"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to employees
        </Link>
        <ErrorState
          title={notFound ? "Employee not found" : "Unable to load employee"}
          message={
            notFound
              ? "This account may have been removed or you do not have access to it."
              : "Please check your connection and try again."
          }
          onRetry={
            notFound
              ? undefined
              : () => {
                  void detailQuery.refetch();
                }
          }
        />
      </div>
    );
  }

  const manageAllowed = canManageUser(user, target);
  const roleAllowed = canChangeUserRole(user, target);
  const isSelf = user?.id === target.id;

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (fullName.trim().length < 2) {
      setFormError("Enter at least 2 characters for the full name.");
      return;
    }

    const updates: { fullName?: string; role?: AssignableRole } = {};
    if (fullName.trim() !== target.fullName) {
      updates.fullName = fullName.trim();
    }
    if (roleAllowed && role !== target.role) {
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No changes to save",
        description: "Update the name or role before saving.",
        variant: "info",
      });
      return;
    }

    try {
      await updateMutation.mutateAsync(updates);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Unable to update the employee right now. Please try again.",
      );
    }
  };

  const accessLabel = target.isActive ? "Deactivate account" : "Activate account";

  return (
    <div className="space-y-5">
      <Link
        to="/employees"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to employees
      </Link>

      <PageHeader
        title={target.fullName}
        description={`Employee account · ${target.email}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={target.role} />
            <StatusBadge active={target.isActive} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar name={target.fullName} size="xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {target.fullName}
                  </h2>
                  {isSelf ? <Badge variant="brand">You</Badge> : null}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {target.email}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {ROLE_LABELS[target.role]} account
                </p>
              </div>
            </div>

            <dl className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  Joined
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {formatDate(target.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Last login
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {formatDateTime(target.lastLoginAt)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Last updated
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {formatDateTime(target.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  Password
                </dt>
                <dd className="mt-1">
                  {target.mustChangePassword ? (
                    <Badge variant="warning">Change required</Badge>
                  ) : (
                    <Badge variant="success">Up to date</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Account access"
            description="Control whether this account can sign in."
          />
          <CardBody className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {target.isActive ? (
                <>
                  This account is <strong className="text-slate-800">active</strong>.
                  Deactivating it signs the user out immediately and blocks future
                  sign-ins.
                </>
              ) : (
                <>
                  This account is <strong className="text-slate-800">inactive</strong>.
                  The user cannot sign in until the account is activated again.
                </>
              )}
            </div>

            {manageAllowed ? (
              <Button
                variant={target.isActive ? "danger" : "primary"}
                className="w-full"
                onClick={() => setConfirmOpen(true)}
                leftIcon={
                  target.isActive ? (
                    <UserX className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                  )
                }
              >
                {accessLabel}
              </Button>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-500">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {isSelf
                    ? "You cannot change access for your own account."
                    : target.role === "owner"
                      ? "The owner account is protected and cannot be changed here."
                      : "Your role cannot change access for this account."}
                </span>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Employee details"
          description={
            manageAllowed
              ? "Update the display name or, for owners, the role."
              : "This account is read-only for your role."
          }
        />
        <CardBody>
          {manageAllowed ? (
            <form onSubmit={handleSave} className="space-y-4" noValidate>
              {formError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                >
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />

                {roleAllowed ? (
                  <Select
                    label="Role"
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value as AssignableRole)
                    }
                    hint="Only the owner can change roles."
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </Select>
                ) : (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-slate-700">
                      Role
                    </p>
                    <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
                      <RoleBadge role={target.role} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Only the owner can change roles.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  isLoading={updateMutation.isPending}
                  leftIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                >
                  Save changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <ShieldCheck
                className="mt-0.5 h-5 w-5 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-800">Protected account</p>
                <p className="mt-0.5">
                  {isSelf
                    ? "Use your profile page to update your own display name."
                    : "Owner and administrator accounts cannot be edited from this page by your role."}
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title={target.isActive ? "Deactivate account?" : "Activate account?"}
        description={
          target.isActive
            ? `${target.fullName} will be signed out immediately and will not be able to sign in until the account is activated again.`
            : `${target.fullName} will be able to sign in again with their existing password.`
        }
        confirmLabel={target.isActive ? "Deactivate" : "Activate"}
        variant={target.isActive ? "danger" : "primary"}
        isLoading={activeMutation.isPending}
        onConfirm={() => activeMutation.mutate(!target.isActive)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
