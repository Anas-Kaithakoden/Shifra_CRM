-- Telegram reminder state for lead follow-ups.
-- New and existing pending follow-ups are reminder-enabled by default so the
-- cron sweep delivers a message at scheduled_at - reminder_minutes_before.
-- Completed/cancelled rows are skipped (and marked skipped) by the sweep.

ALTER TABLE lead_follow_ups
  ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 1;

ALTER TABLE lead_follow_ups
  ADD COLUMN reminder_minutes_before INTEGER NOT NULL DEFAULT 15;

ALTER TABLE lead_follow_ups
  ADD COLUMN reminder_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (
    reminder_status IN ('pending', 'sent', 'failed', 'skipped')
  );

ALTER TABLE lead_follow_ups
  ADD COLUMN reminder_sent_at TEXT;

ALTER TABLE lead_follow_ups
  ADD COLUMN reminder_attempted_at TEXT;

ALTER TABLE lead_follow_ups
  ADD COLUMN reminder_error TEXT;

CREATE INDEX IF NOT EXISTS lead_follow_ups_reminder_idx
  ON lead_follow_ups(reminder_enabled, reminder_status, scheduled_at);
