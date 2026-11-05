import { Info, ShieldCheck } from "lucide-react";
import { Card, CardBody, CardHeader } from "../ui";

export function ReminderSettings() {
  return (
    <Card>
      <CardHeader
        title="About Telegram automated reminders"
        description="How the Worker sweep delivers task and follow-up reminders."
        action={<Info className="h-5 w-5 text-slate-500" aria-hidden="true" />}
      />
      <CardBody className="space-y-4 text-xs leading-relaxed text-slate-600">
        <p>
          Shifra Nuha CRM uses Cloudflare Worker cron triggers executing every
          minute to sweep for tasks and follow-ups approaching their due dates.
        </p>

        <div className="rounded-lg bg-slate-50 p-3 space-y-2">
          <h4 className="font-semibold text-slate-800">How reminders work:</h4>
          <ul className="list-disc pl-4 space-y-1 text-slate-600">
            <li>
              <strong>Timing:</strong> Reminders fire exactly when:{" "}
              <code className="text-brand-700 bg-brand-50 px-1 py-0.5 rounded">
                Current Time &gt;= Due Date - Reminder Offset
              </code>
              .
            </li>
            <li>
              <strong>Idempotent:</strong> Each task receives at most one
              reminder per occurrence. Completed or cancelled tasks are
              automatically skipped.
            </li>
            <li>
              <strong>Automatic Retry:</strong> If delivery fails due to network
              or rate limits, the sweep retries with an exponential 5-minute
              backoff window.
            </li>
            <li>
              <strong>Recurring Tasks:</strong> When a recurring task is
              completed, its next scheduled occurrence gets a fresh pending
              reminder.
            </li>
          </ul>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-800">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Bot credentials and API tokens are stored strictly within Cloudflare
            Worker secrets (<code className="font-mono">wrangler secret put</code>)
            and are never exposed to browser clients or saved in the database.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
