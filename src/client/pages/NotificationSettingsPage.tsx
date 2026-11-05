import { PageHeader } from "../components/ui";
import { ReminderSettings, TelegramStatusCard } from "../components/tasks";

export function NotificationSettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Notification Settings" description="Manage Telegram reminder integration for tasks and follow-ups. Secrets are configured in Cloudflare Worker environment variables." />
      <div className="grid gap-5 lg:grid-cols-2">
        <TelegramStatusCard />
        <ReminderSettings />
      </div>
    </div>
  );
}
