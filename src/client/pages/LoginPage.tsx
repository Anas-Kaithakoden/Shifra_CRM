import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../lib/api";
import { Button, Input, PasswordInput } from "../components/ui";

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const errors: FieldErrors = {};
    if (!email.trim()) {
      errors.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (!password) {
      errors.password = "Enter your password.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const user = await login({ email: email.trim(), password });
      if (user.mustChangePassword) {
        navigate("/change-password", { replace: true });
        return;
      }

      const state = location.state as { from?: string } | null;
      const destination =
        state?.from &&
        state.from.startsWith("/") &&
        !state.from.startsWith("//")
          ? state.from
          : "/dashboard";
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Unable to sign in right now. Please try again.",
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-900 p-10 text-white lg:flex xl:p-14">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-700/60 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-base font-bold ring-1 ring-white/20">
            SN
          </span>
          <div>
            <p className="text-sm font-semibold">Shifra Nuha Technologies</p>
            <p className="text-xs text-brand-200">Internal CRM</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
            One workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Keep your team, clients and delivery in sync.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-brand-100/90">
            Version 2 brings lead management, pipeline tracking and follow-ups
            together with secure employee management. More CRM modules are on
            the way.
          </p>

          <ul className="mt-8 space-y-4">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Target className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium">Lead management</p>
                <p className="text-xs text-brand-200/80">
                  Capture leads, move the pipeline and never miss a follow-up.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Users className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium">Employee management</p>
                <p className="text-xs text-brand-200/80">
                  Roles, access and account status in one place.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium">Secure by design</p>
                <p className="text-xs text-brand-200/80">
                  Session-based access with role-aware permissions.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Activity className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium">Auditable activity</p>
                <p className="text-xs text-brand-200/80">
                  Every important account change is recorded.
                </p>
              </div>
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-brand-200/70">
          Internal system · Authorized personnel only
        </p>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">
              SN
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Shifra Nuha CRM
              </p>
              <p className="text-xs text-slate-500">Internal workspace</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Sign in to your account
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Use the credentials provided by your CRM owner.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{formError}</span>
              </div>
            ) : null}

            <Input
              label="Email address"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@shifranuha.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors.email}
              required
            />

            <PasswordInput
              label="Password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password}
              required
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isLoggingIn}
              rightIcon={
                isLoggingIn ? undefined : (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                )
              }
            >
              {isLoggingIn ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {import.meta.env.DEV ? (
            <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
              <p className="font-semibold text-slate-600">
                Local development accounts
              </p>
              <p className="mt-1">
                Run <code className="rounded bg-slate-100 px-1">npm run db:seed</code>{" "}
                once, then sign in with:
              </p>
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-600">
                <li>owner@shifranuha.dev · Owner#12345!</li>
                <li>admin@shifranuha.dev · Admin#12345!</li>
                <li>employee@shifranuha.dev · Employee#12345!</li>
              </ul>
              <p className="mt-2 text-[11px] text-amber-700">
                Development seed data only. Never use these credentials in
                production.
              </p>
            </div>
          ) : null}

          <p className="mt-6 text-center text-xs text-slate-400">
            Access is monitored and recorded. Contact the owner if you need help
            signing in.
          </p>
        </div>
      </div>
    </div>
  );
}
