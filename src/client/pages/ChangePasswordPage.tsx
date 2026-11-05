import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Check, KeyRound, ShieldCheck, X } from "lucide-react";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  checkPasswordPolicy,
} from "../../shared/constants/password";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { authService } from "../services/auth.service";
import { ApiError, setCsrfToken } from "../lib/api";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  PasswordInput,
} from "../components/ui";

export function ChangePasswordPage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const changeMutation = useMutation({
    mutationFn: () =>
      authService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    onSuccess: (result) => {
      setCsrfToken(result.csrfToken);
      setUser(result.user);
      toast({
        title: "Password changed",
        description: "Other sessions have been signed out.",
        variant: "success",
      });
      navigate("/dashboard", { replace: true });
    },
  });

  const checks = [
    {
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: newPassword.length >= PASSWORD_MIN_LENGTH,
    },
    {
      label: "One lowercase letter",
      met: /[a-z]/.test(newPassword),
    },
    {
      label: "One uppercase letter",
      met: /[A-Z]/.test(newPassword),
    },
    {
      label: "One number",
      met: /[0-9]/.test(newPassword),
    },
    {
      label: `No more than ${PASSWORD_MAX_LENGTH} characters`,
      met:
        newPassword.length > 0 && newPassword.length <= PASSWORD_MAX_LENGTH,
    },
  ];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (!currentPassword) {
      errors.currentPassword = "Enter your current password.";
    }
    if (!newPassword) {
      errors.newPassword = "Enter a new password.";
    } else {
      const policy = checkPasswordPolicy(newPassword);
      if (!policy.valid) {
        errors.newPassword = policy.errors[0] ?? "Choose a stronger password.";
      } else if (newPassword === currentPassword) {
        errors.newPassword = "The new password must be different from the current password.";
      }
    }
    if (!confirmPassword) {
      errors.confirmPassword = "Confirm your new password.";
    } else if (confirmPassword !== newPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      await changeMutation.mutateAsync();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "invalid_current_password") {
          setFieldErrors({ currentPassword: error.message });
          return;
        }
        setFormError(error.message);
        return;
      }
      setFormError("Unable to change your password right now. Please try again.");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Change password"
        description="Choose a strong password that you do not use anywhere else."
      />

      {user?.mustChangePassword ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Your account was created with a temporary password. Change it now to
            continue using the CRM.
          </span>
        </div>
      ) : null}

      <div className="max-w-2xl">
        <Card>
          <CardHeader
            title="Update your password"
            description="You will remain signed in on this browser."
          />
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {formError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                >
                  {formError}
                </div>
              ) : null}

              <PasswordInput
                label="Current password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                error={fieldErrors.currentPassword}
                required
              />

              <PasswordInput
                label="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                error={fieldErrors.newPassword}
                required
              />

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600">
                  Password requirements
                </p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {checks.map((check) => (
                    <li
                      key={check.label}
                      className={
                        check.met
                          ? "flex items-center gap-1.5 text-xs text-emerald-700"
                          : "flex items-center gap-1.5 text-xs text-slate-500"
                      }
                    >
                      {check.met ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {check.label}
                    </li>
                  ))}
                </ul>
              </div>

              <PasswordInput
                label="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
                required
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-400">
                  Changing your password signs out all other active sessions.
                </p>
                <Button
                  type="submit"
                  isLoading={changeMutation.isPending}
                  leftIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
                >
                  Update password
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
