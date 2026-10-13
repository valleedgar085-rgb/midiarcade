export const MIDI_ARCADE_DB_SCHEMA_VERSION = 1;

export const MIDI_ARCADE_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS generation_runs (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  seed TEXT,
  genre TEXT,
  requested_bars INTEGER,
  engine_version TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  config_json TEXT
);

CREATE TABLE IF NOT EXISTS song_blueprints (
  id TEXT PRIMARY KEY,
  generation_run_id TEXT NOT NULL UNIQUE,
  blueprint_json TEXT NOT NULL,
  FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groove_dna (
  id TEXT PRIMARY KEY,
  generation_run_id TEXT NOT NULL UNIQUE,
  genre TEXT,
  subdivision REAL,
  groove_json TEXT NOT NULL,
  FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS harmony_timelines (
  id TEXT PRIMARY KEY,
  generation_run_id TEXT NOT NULL UNIQUE,
  harmony_json TEXT NOT NULL,
  FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  generation_run_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  section_json TEXT NOT NULL,
  FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  generation_run_id TEXT NOT NULL,
  role TEXT NOT NULL,
  track_json TEXT NOT NULL,
  FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS musical_events (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  start_beat REAL NOT NULL,
  duration_beats REAL NOT NULL,
  pitch INTEGER,
  velocity INTEGER,
  event_json TEXT NOT NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_generation_runs_song
  ON generation_runs(song_id, started_at);

CREATE INDEX IF NOT EXISTS idx_sections_run
  ON sections(generation_run_id, ordinal);

CREATE INDEX IF NOT EXISTS idx_tracks_run
  ON tracks(generation_run_id);

CREATE INDEX IF NOT EXISTS idx_events_track_start
  ON musical_events(track_id, start_beat);
`;

export function databaseMigrationPlan(currentVersion = 0) {
  const version = Number(currentVersion) || 0;
  if (version >= MIDI_ARCADE_DB_SCHEMA_VERSION) return [];
  return [{
    version: 1,
    name: "generation-history-foundation",
    sql: MIDI_ARCADE_SCHEMA_SQL,
  }];
}
