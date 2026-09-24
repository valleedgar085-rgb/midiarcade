PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    email TEXT,
    plan TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    default_bpm REAL,
    default_key TEXT,
    default_scale TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    user_id TEXT,
    title TEXT NOT NULL,
    genre TEXT NOT NULL,
    bpm REAL NOT NULL,
    musical_key TEXT NOT NULL,
    scale TEXT NOT NULL,
    time_signature TEXT NOT NULL DEFAULT '4/4',
    bars INTEGER NOT NULL,
    seed TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    selected_version_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS song_versions (
    id TEXT PRIMARY KEY,
    song_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    source_version_id TEXT,
    change_reason TEXT,
    snapshot_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(song_id, version_number),
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    FOREIGN KEY (source_version_id) REFERENCES song_versions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS generation_runs (
    id TEXT PRIMARY KEY,
    song_id TEXT NOT NULL,
    source_song_id TEXT,
    kind TEXT NOT NULL DEFAULT 'new',
    engine_version TEXT,
    producer_brain_id TEXT,
    producer_brain_version INTEGER,
    thinking_depth TEXT,
    candidate_count INTEGER,
    adaptive_candidates INTEGER NOT NULL DEFAULT 1,
    weakness_aware_search INTEGER NOT NULL DEFAULT 1,
    targeted_repair INTEGER NOT NULL DEFAULT 1,
    seed TEXT,
    genre TEXT,
    requested_bars INTEGER,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    runtime_ms INTEGER,
    outcome TEXT,
    error_message TEXT,
    config_json TEXT,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    FOREIGN KEY (source_song_id) REFERENCES songs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS song_blueprints (
    id TEXT PRIMARY KEY,
    generation_run_id TEXT NOT NULL UNIQUE,
    intent TEXT,
    energy_arc_json TEXT,
    arrangement_plan_json TEXT,
    harmony_plan_json TEXT,
    groove_plan_json TEXT,
    instrumentation_plan_json TEXT,
    transition_plan_json TEXT,
    narrative_plan_json TEXT,
    blueprint_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    song_id TEXT NOT NULL,
    generation_run_id TEXT,
    name TEXT NOT NULL,
    section_type TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    start_bar INTEGER NOT NULL,
    end_bar INTEGER NOT NULL,
    energy REAL,
    density_target REAL,
    payoff_role TEXT,
    section_json TEXT,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE,
    CHECK (end_bar >= start_bar),
    UNIQUE(song_id, generation_run_id, ordinal)
);

CREATE TABLE IF NOT EXISTS groove_dna (
    id TEXT PRIMARY KEY,
    generation_run_id TEXT NOT NULL UNIQUE,
    genre TEXT NOT NULL,
    tempo REAL NOT NULL,
    swing REAL NOT NULL DEFAULT 0,
    pocket REAL NOT NULL DEFAULT 0,
    subdivision TEXT,
    kick_grammar_json TEXT NOT NULL,
    snare_grammar_json TEXT NOT NULL,
    hat_grammar_json TEXT NOT NULL,
    percussion_grammar_json TEXT,
    bass_relationship_json TEXT,
    chord_relationship_json TEXT,
    lead_relationship_json TEXT,
    transformations_json TEXT,
    humanization_json TEXT,
    groove_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS harmony_timelines (
    id TEXT PRIMARY KEY,
    generation_run_id TEXT NOT NULL UNIQUE,
    key_center TEXT NOT NULL,
    scale TEXT NOT NULL,
    chord_language TEXT,
    modulation_policy TEXT,
    harmony_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS harmony_events (
    id TEXT PRIMARY KEY,
    harmony_timeline_id TEXT NOT NULL,
    section_id TEXT,
    start_beat REAL NOT NULL,
    duration_beats REAL NOT NULL,
    root TEXT NOT NULL,
    chord_symbol TEXT NOT NULL,
    chord_tones_json TEXT,
    scale_context TEXT,
    function TEXT,
    FOREIGN KEY (harmony_timeline_id) REFERENCES harmony_timelines(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    song_id TEXT NOT NULL,
    generation_run_id TEXT,
    role TEXT NOT NULL,
    instrument_name TEXT,
    midi_channel INTEGER,
    midi_program INTEGER,
    octave_center INTEGER,
    min_pitch INTEGER,
    max_pitch INTEGER,
    muted INTEGER NOT NULL DEFAULT 0,
    soloed INTEGER NOT NULL DEFAULT 0,
    track_json TEXT,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS musical_events (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    section_id TEXT,
    event_type TEXT NOT NULL DEFAULT 'note',
    start_beat REAL NOT NULL,
    duration_beats REAL NOT NULL DEFAULT 0,
    pitch INTEGER,
    velocity INTEGER,
    probability REAL NOT NULL DEFAULT 1,
    articulation TEXT,
    microtiming_ms REAL NOT NULL DEFAULT 0,
    source TEXT,
    locked INTEGER NOT NULL DEFAULT 0,
    event_json TEXT,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
    CHECK (pitch IS NULL OR (pitch >= 0 AND pitch <= 127)),
    CHECK (velocity IS NULL OR (velocity >= 0 AND velocity <= 127)),
    CHECK (probability >= 0 AND probability <= 1)
);

CREATE TABLE IF NOT EXISTS generation_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_run_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    stage_order INTEGER,
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,
    status TEXT,
    details_json TEXT,
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quality_evaluations (
    id TEXT PRIMARY KEY,
    generation_run_id TEXT NOT NULL,
    evaluation_phase TEXT NOT NULL,
    overall_score REAL,
    harmony_score REAL,
    groove_score REAL,
    structure_score REAL,
    density_score REAL,
    register_score REAL,
    melody_score REAL,
    ensemble_score REAL,
    transition_score REAL,
    novelty_score REAL,
    genre_authenticity_score REAL,
    preview_export_parity_score REAL,
    passed INTEGER NOT NULL DEFAULT 0,
    weaknesses_json TEXT,
    evaluation_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repair_actions (
    id TEXT PRIMARY KEY,
    generation_run_id TEXT NOT NULL,
    quality_evaluation_id TEXT,
    target_scope TEXT NOT NULL,
    target_id TEXT,
    repair_type TEXT NOT NULL,
    before_metrics_json TEXT,
    repair_json TEXT,
    after_metrics_json TEXT,
    accepted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (quality_evaluation_id) REFERENCES quality_evaluations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS candidate_results (
    id TEXT PRIMARY KEY,
    generation_run_id TEXT NOT NULL,
    candidate_index INTEGER NOT NULL,
    seed TEXT,
    score REAL,
    accepted INTEGER NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    metrics_json TEXT,
    candidate_json TEXT,
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE,
    UNIQUE(generation_run_id, candidate_index)
);

CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    song_id TEXT NOT NULL,
    generation_run_id TEXT,
    format TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_uri TEXT,
    checksum TEXT,
    exported_at TEXT NOT NULL DEFAULT (datetime('now')),
    export_json TEXT,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS debugger_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_run_id TEXT,
    song_id TEXT,
    severity TEXT NOT NULL DEFAULT 'info',
    subsystem TEXT NOT NULL,
    code TEXT,
    message TEXT NOT NULL,
    context_json TEXT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    song_id TEXT,
    generation_run_id TEXT,
    rating INTEGER,
    groove_rating INTEGER,
    harmony_rating INTEGER,
    structure_rating INTEGER,
    comments TEXT,
    keep_song INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id) ON DELETE SET NULL,
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT,
    plan TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT,
    renews_at TEXT,
    ended_at TEXT,
    provider_reference TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_songs_project ON songs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_song ON generation_runs(song_id, started_at);
CREATE INDEX IF NOT EXISTS idx_sections_song_run ON sections(song_id, generation_run_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_tracks_song_run ON tracks(song_id, generation_run_id);
CREATE INDEX IF NOT EXISTS idx_events_track_start ON musical_events(track_id, start_beat);
CREATE INDEX IF NOT EXISTS idx_quality_run_phase ON quality_evaluations(generation_run_id, evaluation_phase);
CREATE INDEX IF NOT EXISTS idx_repairs_run ON repair_actions(generation_run_id);
CREATE INDEX IF NOT EXISTS idx_debug_run_time ON debugger_events(generation_run_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_feedback_song ON user_feedback(song_id, created_at);

CREATE VIEW IF NOT EXISTS v_generation_quality AS
SELECT
    gr.id AS generation_run_id,
    gr.song_id,
    gr.genre,
    gr.engine_version,
    gr.runtime_ms,
    qe.evaluation_phase,
    qe.overall_score,
    qe.harmony_score,
    qe.groove_score,
    qe.structure_score,
    qe.density_score,
    qe.register_score,
    qe.ensemble_score,
    qe.genre_authenticity_score,
    qe.passed,
    qe.created_at
FROM generation_runs gr
JOIN quality_evaluations qe ON qe.generation_run_id = gr.id;

CREATE VIEW IF NOT EXISTS v_song_event_density AS
SELECT
    s.id AS song_id,
    s.title,
    s.genre,
    s.bars,
    COUNT(me.id) AS event_count,
    CASE WHEN s.bars > 0 THEN CAST(COUNT(me.id) AS REAL) / s.bars ELSE NULL END AS events_per_bar
FROM songs s
LEFT JOIN tracks t ON t.song_id = s.id
LEFT JOIN musical_events me ON me.track_id = t.id
GROUP BY s.id, s.title, s.genre, s.bars;

INSERT OR REPLACE INTO app_meta(key, value) VALUES
('schema_version', '1'),
('app', 'MIDI Arcade'),
('database_mode', 'offline-first');
