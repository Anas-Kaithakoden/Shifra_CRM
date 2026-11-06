-- Recurring service details and Telegram renewal-reminder bookkeeping.
-- All columns are nullable so existing customer records remain valid.

ALTER TABLE customers
  ADD COLUMN service_name TEXT;

ALTER TABLE customers
  ADD COLUMN service_category TEXT
  CHECK (
    service_category IS NULL
    OR service_category IN (
      'business_solutions',
      'digital_solutions',
      'branding_creative'
    )
  );

-- Tracks the renewal date for which a reminder was already sent. This keeps
-- the cron sweep idempotent and re-arms the reminder when the date changes.
ALTER TABLE customers
  ADD COLUMN renewal_reminder_for TEXT;

ALTER TABLE customers
  ADD COLUMN renewal_reminder_sent_at TEXT;

ALTER TABLE customers
  ADD COLUMN renewal_reminder_attempted_at TEXT;

ALTER TABLE customers
  ADD COLUMN renewal_reminder_error TEXT;

CREATE INDEX IF NOT EXISTS customers_service_category_idx
  ON customers(service_category);

CREATE INDEX IF NOT EXISTS customers_renewal_reminder_idx
  ON customers(renewal_on, renewal_reminder_for);
