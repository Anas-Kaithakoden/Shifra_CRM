import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Button, Card, CardBody } from "../components/ui";

export function ForbiddenPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col items-center py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">
            Access denied
          </h1>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Your role does not have permission to view this page. Contact the CRM
            owner if you believe you need access.
          </p>
          <Link to={user ? "/dashboard" : "/login"} className="mt-5">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
            >
              Back to dashboard
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
