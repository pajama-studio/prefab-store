-- prefab-store: one row per package (the JSON package is the source of truth)
CREATE TABLE IF NOT EXISTS prefab_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  package TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prefab_packages_updated ON prefab_packages (updated_at DESC);
