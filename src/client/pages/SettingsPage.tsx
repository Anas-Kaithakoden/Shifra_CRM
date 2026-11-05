import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Clock,
  DollarSign,
  Globe,
  Mail,
  Phone,
  Save,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { AppSettingsDto } from "../../shared/types/api";
import type { SettingsFormValues } from "../types/forms";
import { useToast } from "../hooks/useToast";
import { settingsService } from "../services/settings.service";
import { ApiError } from "../lib/api";
import { formatDateTime } from "../lib/format";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Input,
  PageHeader,
  Skeleton,
} from "../components/ui";

const TIMEZONE_SUGGESTIONS = [
  "UTC",
  "Africa/Nairobi",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
];

function SettingsForm({ settings }: { settings: AppSettingsDto }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<SettingsFormValues>({
    companyName: settings.companyName,
    companyEmail: settings.companyEmail,
    companyPhone: settings.companyPhone,
    companyWebsite: settings.companyWebsite,
    timezone: settings.timezone,
    currency: settings.currency,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SettingsFormValues, string>>>({});

  const updateMutation = useMutation({
    mutationFn: (input: SettingsFormValues) => settingsService.update(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings"], updated);
      toast({
        title: "Settings saved",
        description: "Your CRM settings have been updated.",
        variant: "success",
      });
      setFormError(null);
      setFieldErrors({});
    },
  });

  const update = (key: keyof SettingsFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const errors: Partial<Record<keyof SettingsFormValues, string>> = {};
    if (!values.companyName.trim()) {
      errors.companyName = "Enter your company name.";
    }
    if (
      values.companyEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.companyEmail.trim())
    ) {
      errors.companyEmail = "Enter a valid email address.";
    }
    if (values.companyWebsite.trim()) {
      try {
        const parsed = new URL(values.companyWebsite.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          errors.companyWebsite = "Use an http or https URL.";
        }
      } catch {
        errors.companyWebsite = "Enter a valid URL, including https://.";
      }
    }
    if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) {
      errors.currency = "Use a 3-letter currency code.";
    }
    if (!values.timezone.trim()) {
      errors.timezone = "Enter a timezone.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      await updateMutation.mutateAsync({
        companyName: values.companyName.trim(),
        companyEmail: values.companyEmail.trim().toLowerCase(),
        companyPhone: values.companyPhone.trim(),
        companyWebsite: values.companyWebsite.trim(),
        timezone: values.timezone.trim(),
        currency: values.currency.trim().toUpperCase(),
      });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Unable to save settings right now. Please try again.",
      );
    }
  };

  const handleReset = () => {
    setValues({
      companyName: settings.companyName,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
      companyWebsite: settings.companyWebsite,
      timezone: settings.timezone,
      currency: settings.currency,
    });
    setFieldErrors({});
    setFormError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
          label="Company name"
          value={values.companyName}
          onChange={(event) => update("companyName", event.target.value)}
          leadingIcon={<Building2 className="h-4 w-4" aria-hidden="true" />}
          error={fieldErrors.companyName}
          required
        />
        <Input
          label="Company email"
          type="email"
          value={values.companyEmail}
          onChange={(event) => update("companyEmail", event.target.value)}
          leadingIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
          placeholder="hello@shifranuhatech.com"
          error={fieldErrors.companyEmail}
        />
        <Input
          label="Phone number"
          value={values.companyPhone}
          onChange={(event) => update("companyPhone", event.target.value)}
          leadingIcon={<Phone className="h-4 w-4" aria-hidden="true" />}
          placeholder="+254 700 000 000"
          error={fieldErrors.companyPhone}
        />
        <Input
          label="Website"
          type="url"
          value={values.companyWebsite}
          onChange={(event) => update("companyWebsite", event.target.value)}
          leadingIcon={<Globe className="h-4 w-4" aria-hidden="true" />}
          placeholder="https://shifranuhatech.com"
          error={fieldErrors.companyWebsite}
        />
        <div>
          <Input
            label="Timezone"
            list="timezone-suggestions"
            value={values.timezone}
            onChange={(event) => update("timezone", event.target.value)}
            leadingIcon={<Clock className="h-4 w-4" aria-hidden="true" />}
            error={fieldErrors.timezone}
            hint="Use an IANA timezone identifier."
            required
          />
          <datalist id="timezone-suggestions">
            {TIMEZONE_SUGGESTIONS.map((timezone) => (
              <option key={timezone} value={timezone} />
            ))}
          </datalist>
        </div>
        <Input
          label="Currency"
          value={values.currency}
          onChange={(event) => update("currency", event.target.value.toUpperCase())}
          leadingIcon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
          maxLength={3}
          error={fieldErrors.currency}
          hint="Three-letter ISO code, for example USD or KES."
          required
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          {settings.updatedAt
            ? `Last updated ${formatDateTime(settings.updatedAt)}`
            : "Using default settings."}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} disabled={updateMutation.isPending}>
            Reset
          </Button>
          <Button
            type="submit"
            isLoading={updateMutation.isPending}
            leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
          >
            Save settings
          </Button>
        </div>
      </div>
    </form>
  );
}

export function SettingsPage() {
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsService.get(),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Organization details used across the CRM. Owner access only."
      />

      {settingsQuery.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : settingsQuery.isError || !settingsQuery.data ? (
        <ErrorState
          title="Unable to load settings"
          message="Please check your connection and try again."
          onRetry={() => {
            void settingsQuery.refetch();
          }}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Organization profile"
              description="These details identify your organization inside the CRM."
            />
            <CardBody>
              <SettingsForm
                key={settingsQuery.data.updatedAt ?? "defaults"}
                settings={settingsQuery.data}
              />
            </CardBody>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Access" description="Who can change these settings." />
              <CardBody className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Owner only</p>
                    <p className="text-xs text-slate-500">
                      Administrators and employees cannot view or change CRM
                      settings.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Settings className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Audited</p>
                    <p className="text-xs text-slate-500">
                      Every settings update is recorded in the audit log.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Timezone & currency" />
              <CardBody className="space-y-2 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-800">Timezone:</span>{" "}
                  {settingsQuery.data.timezone}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Currency:</span>{" "}
                  {settingsQuery.data.currency}
                </p>
                <p className="text-xs text-slate-400">
                  These values will be used by reporting and payments modules in
                  future releases.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
