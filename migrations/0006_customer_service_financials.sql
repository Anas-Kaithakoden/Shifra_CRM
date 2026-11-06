-- Customer service financials and renewal tracking.
-- All columns are nullable so existing customer records remain valid.

ALTER TABLE customers
  ADD COLUMN total_cost REAL CHECK (total_cost IS NULL OR total_cost >= 0);

ALTER TABLE customers
  ADD COLUMN profit REAL;

ALTER TABLE customers
  ADD COLUMN service_delivered_on TEXT
  CHECK (
    service_delivered_on IS NULL
    OR date(service_delivered_on) = service_delivered_on
  );

ALTER TABLE customers
  ADD COLUMN renewal_on TEXT
  CHECK (renewal_on IS NULL OR date(renewal_on) = renewal_on);

CREATE INDEX IF NOT EXISTS customers_service_delivered_on_idx
  ON customers(service_delivered_on);

CREATE INDEX IF NOT EXISTS customers_renewal_on_idx
  ON customers(renewal_on);
