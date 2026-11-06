-- Multiple independently renewing services per customer.
-- The legacy service_* / total_cost / profit / renewal_* columns on customers
-- remain in place for backward compatibility and are kept in sync with the
-- first (primary) service by the application.

CREATE TABLE IF NOT EXISTS customer_services (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_category TEXT
    CHECK (
      service_category IS NULL
      OR service_category IN (
        'business_solutions',
        'digital_solutions',
        'branding_creative'
      )
    ),
  total_cost REAL CHECK (total_cost IS NULL OR total_cost >= 0),
  profit REAL,
  service_delivered_on TEXT
    CHECK (
      service_delivered_on IS NULL
      OR date(service_delivered_on) = service_delivered_on
    ),
  renewal_on TEXT
    CHECK (renewal_on IS NULL OR date(renewal_on) = renewal_on),
  renewal_reminder_for TEXT,
  renewal_reminder_sent_at TEXT,
  renewal_reminder_attempted_at TEXT,
  renewal_reminder_error TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(service_name) BETWEEN 1 AND 160)
);

CREATE INDEX IF NOT EXISTS customer_services_customer_id_idx
  ON customer_services(customer_id);

CREATE INDEX IF NOT EXISTS customer_services_renewal_on_idx
  ON customer_services(renewal_on);

CREATE INDEX IF NOT EXISTS customer_services_reminder_idx
  ON customer_services(renewal_on, renewal_reminder_for);

CREATE INDEX IF NOT EXISTS customer_services_created_at_idx
  ON customer_services(created_at);

-- Move each existing customer's single service into the new table so historical
-- renewals and reminder state are preserved.
INSERT INTO customer_services (
  id,
  customer_id,
  service_name,
  service_category,
  total_cost,
  profit,
  service_delivered_on,
  renewal_on,
  renewal_reminder_for,
  renewal_reminder_sent_at,
  renewal_reminder_attempted_at,
  renewal_reminder_error,
  created_by,
  created_at,
  updated_at
)
SELECT
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))),
  id,
  COALESCE(service_name, 'General service'),
  service_category,
  total_cost,
  profit,
  service_delivered_on,
  renewal_on,
  renewal_reminder_for,
  renewal_reminder_sent_at,
  renewal_reminder_attempted_at,
  renewal_reminder_error,
  created_by,
  created_at,
  updated_at
FROM customers
WHERE
  service_name IS NOT NULL
  OR service_category IS NOT NULL
  OR total_cost IS NOT NULL
  OR profit IS NOT NULL
  OR service_delivered_on IS NOT NULL
  OR renewal_on IS NOT NULL;
