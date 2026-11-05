CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  task_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  project_id TEXT,
  due_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_minutes_before INTEGER,
  reminder_sent_at TEXT,
  reminder_attempted_at TEXT,
  reminder_status TEXT NOT NULL DEFAULT 'pending',
  reminder_error TEXT,
  recurrence_type TEXT,
  recurrence_interval INTEGER,
  recurrence_end_at TEXT,
  recurrence_group_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX tasks_assigned_to_idx ON tasks(assigned_to);
CREATE INDEX tasks_status_idx ON tasks(status);
CREATE INDEX tasks_type_idx ON tasks(task_type);
CREATE INDEX tasks_due_at_idx ON tasks(due_at);
CREATE INDEX tasks_lead_id_idx ON tasks(lead_id);
CREATE INDEX tasks_customer_id_idx ON tasks(customer_id);
CREATE INDEX tasks_created_at_idx ON tasks(created_at);

CREATE TABLE IF NOT EXISTS task_number_sequence (
  id INTEGER PRIMARY KEY,
  next_value INTEGER NOT NULL DEFAULT 1
);
INSERT INTO task_number_sequence (id, next_value) VALUES (1, 1) ON CONFLICT(id) DO NOTHING;
