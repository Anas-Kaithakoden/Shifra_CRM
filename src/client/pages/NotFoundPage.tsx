import { Link } from "react-router-dom";
import { ArrowLeft, SearchX } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui";

export function NotFoundPage() {
  const { user } = useAuth();
  const destination = user ? "/dashboard" : "/login";
  const label = user ? "Back to dashboard" : "Go to sign in";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <SearchX className="h-8 w-8" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          404
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The page you are looking for does not exist, has moved, or is not part
          of this version of the CRM.
        </p>
        <Link to={destination} className="mt-6 inline-block">
          <Button
            leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            {label}
          </Button>
        </Link>
      </div>
    </div>
  );
}
