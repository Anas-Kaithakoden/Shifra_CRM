CREATE TABLE IF NOT EXISTS task_activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS task_activities_task_id_idx ON task_activities(task_id);
CREATE INDEX IF NOT EXISTS task_activities_user_id_idx ON task_activities(user_id);
CREATE INDEX IF NOT EXISTS task_activities_created_at_idx ON task_activities(created_at);
