-- prefab-store: one row per prefab (the JSON package is the source of truth)
CREATE TABLE IF NOT EXISTS prefabs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prefabs_updated ON prefabs (updated_at DESC);
