import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "../../shared/types/roles";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { authService } from "../services/auth.service";
import { ApiError } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  PageHeader,
  RoleBadge,
  StatusBadge,
} from "../components/ui";

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user?.fullName ?? "");
  }, [user?.fullName]);

  const updateMutation = useMutation({
    mutationFn: (name: string) => authService.updateProfile(name),
    onSuccess: (result) => {
      setUser(result.user);
      toast({
        title: "Profile updated",
        description: "Your display name has been saved.",
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setError(null);
    },
  });

  if (!user) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError("Enter at least 2 characters for your full name.");
      return;
    }
    if (fullName.trim() === user.fullName) {
      toast({
        title: "No changes to save",
        description: "Update your name before saving.",
        variant: "info",
      });
      return;
    }

    try {
      await updateMutation.mutateAsync(fullName.trim());
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Unable to update your profile right now. Please try again.",
      );
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="My profile"
        description="Your account details and security settings."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar name={user.fullName} size="xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {user.fullName}
                  </h2>
                  <RoleBadge role={user.role} />
                  <StatusBadge active={user.isActive} />
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {user.email}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {ROLE_DESCRIPTIONS[user.role]}
                </p>
              </div>
            </div>

            <dl className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Role
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {ROLE_LABELS[user.role]}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  Member since
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {formatDate(user.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Last login
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {formatDateTime(user.lastLoginAt)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  Password
                </dt>
                <dd className="mt-1">
                  {user.mustChangePassword ? (
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
          <CardHeader title="Security" description="Keep your account protected." />
          <CardBody className="space-y-3">
            <p className="text-sm text-slate-600">
              Changing your password signs out every other active session. You
              will stay signed in on this browser.
            </p>
            <Link to="/change-password" className="block">
              <Button
                variant="outline"
                className="w-full"
                leftIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
              >
                Change password
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Display name"
          description="This name appears in the sidebar and audit log."
        />
        <CardBody>
          <form onSubmit={handleSubmit} className="max-w-lg space-y-4" noValidate>
            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                {error}
              </div>
            ) : null}

            <Input
              label="Full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              leadingIcon={<UserRound className="h-4 w-4" aria-hidden="true" />}
              autoComplete="name"
              required
            />

            <Input
              label="Email address"
              value={user.email}
              disabled
              leadingIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
              hint="Email addresses are managed by the CRM owner."
            />

            <div className="flex justify-end">
              <Button type="submit" isLoading={updateMutation.isPending}>
                Save profile
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
