package com.midiarcade.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Offline-first SQLite persistence for accepted MIDI Arcade generations.
 *
 * The Java layer does not compose, repair, or reinterpret music. It receives
 * the post-Gauntlet generation record and persists the exact accepted
 * Blueprint, Groove DNA, rendered MusicalEvents, quality evidence, and repairs.
 */
@CapacitorPlugin(name = "GenerationDatabase")
public class GenerationDatabasePlugin extends Plugin {
    private GenerationDatabaseHelper database;

    @Override
    public void load() {
        database = new GenerationDatabaseHelper(getContext());
        database.getWritableDatabase();
    }

    @PluginMethod
    public void persistGeneration(PluginCall call) {
        JSObject record = call.getObject("record");
        if (record == null) {
            call.reject("A generation record is required.");
            return;
        }
        String schema = record.getString("schema", "");
        if (!"midi-arcade/generation-record@1".equals(schema)) {
            call.reject("Unsupported generation record schema.");
            return;
        }

        try {
            PersistResult persisted = database.persistGeneration(record);
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("songId", persisted.songId);
            result.put("generationRunId", persisted.generationRunId);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not persist the accepted generation.", error);
        }
    }

    @PluginMethod
    public void recentDebuggerEvents(PluginCall call) {
        Integer requested = call.getInt("limit");
        int limit = Math.max(1, Math.min(100, requested == null ? 64 : requested));
        try {
            JSObject result = new JSObject();
            result.put("events", database.recentDebuggerEvents(limit));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read generation debugger history.", error);
        }
    }

    @PluginMethod
    public void recentRuns(PluginCall call) {
        Integer requested = call.getInt("limit");
        int limit = Math.max(1, Math.min(100, requested == null ? 12 : requested));
        try {
            JSObject result = new JSObject();
            result.put("runs", database.recentRuns(limit));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read generation history.", error);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (database != null) {
            database.close();
            database = null;
        }
    }

    private static final class PersistResult {
        final String songId;
        final String generationRunId;

        PersistResult(String songId, String generationRunId) {
            this.songId = songId;
            this.generationRunId = generationRunId;
        }
    }

    private static final class GenerationDatabaseHelper extends SQLiteOpenHelper {
        private static final String DATABASE_NAME = "midi_arcade.db";
        private static final int DATABASE_VERSION = 1;
        private static final String SCHEMA_ASSET = "midi_arcade_schema.sql";
        private final Context context;

        GenerationDatabaseHelper(Context context) {
            super(context, DATABASE_NAME, null, DATABASE_VERSION);
            this.context = context.getApplicationContext();
        }

        @Override
        public void onConfigure(SQLiteDatabase db) {
            super.onConfigure(db);
            db.setForeignKeyConstraintsEnabled(true);
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            executeSchema(db);
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
            executeSchema(db);
        }

        private void executeSchema(SQLiteDatabase db) {
            final String sql;
            try {
                sql = readAssetText(SCHEMA_ASSET);
            } catch (IOException error) {
                throw new IllegalStateException("Could not read MIDI Arcade database schema.", error);
            }
            for (String statement : sql.split(";")) {
                String trimmed = statement.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("PRAGMA foreign_keys")) continue;
                db.execSQL(trimmed);
            }
        }

        private String readAssetText(String name) throws IOException {
            try (InputStream input = context.getAssets().open(name);
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                }
                return output.toString(StandardCharsets.UTF_8.name());
            }
        }

        PersistResult persistGeneration(JSObject record) {
            JSObject song = requiredObject(record, "song");
            JSObject version = requiredObject(record, "songVersion");
            JSObject run = requiredObject(record, "generationRun");
            String songId = requiredText(song, "id");
            String runId = requiredText(run, "id");

            SQLiteDatabase db = getWritableDatabase();
            db.beginTransaction();
            try {
                upsert(db, "songs", song,
                    "id", "project_id", "user_id", "title", "genre", "bpm", "musical_key",
                    "scale", "time_signature", "bars", "seed", "status", "selected_version_id");

                JSObject safeVersion = cloneObject(version);
                String sourceVersionId = safeVersion.getString("source_version_id", null);
                if (sourceVersionId != null && !rowExists(db, "song_versions", sourceVersionId)) {
                    safeVersion.remove("source_version_id");
                }
                upsert(db, "song_versions", safeVersion,
                    "id", "song_id", "version_number", "source_version_id", "change_reason", "snapshot_json");

                JSObject safeRun = cloneObject(run);
                String sourceSongId = safeRun.getString("source_song_id", null);
                if (sourceSongId != null && !rowExists(db, "songs", sourceSongId)) {
                    safeRun.remove("source_song_id");
                }
                upsert(db, "generation_runs", safeRun,
                    "id", "song_id", "source_song_id", "kind", "engine_version",
                    "producer_brain_id", "producer_brain_version", "thinking_depth", "candidate_count",
                    "adaptive_candidates", "weakness_aware_search", "targeted_repair", "seed", "genre",
                    "requested_bars", "started_at", "completed_at", "runtime_ms", "outcome",
                    "error_message", "config_json");

                upsertOptional(db, "song_blueprints", record.optJSONObject("blueprint"),
                    "id", "generation_run_id", "intent", "energy_arc_json", "arrangement_plan_json",
                    "harmony_plan_json", "groove_plan_json", "instrumentation_plan_json",
                    "transition_plan_json", "narrative_plan_json", "blueprint_json");

                upsertOptional(db, "groove_dna", record.optJSONObject("grooveDna"),
                    "id", "generation_run_id", "genre", "tempo", "swing", "pocket", "subdivision",
                    "kick_grammar_json", "snare_grammar_json", "hat_grammar_json",
                    "percussion_grammar_json", "bass_relationship_json", "chord_relationship_json",
                    "lead_relationship_json", "transformations_json", "humanization_json", "groove_json");

                upsertOptional(db, "harmony_timelines", record.optJSONObject("harmonyTimeline"),
                    "id", "generation_run_id", "key_center", "scale", "chord_language",
                    "modulation_policy", "harmony_json");

                upsertArray(db, "sections", record.optJSONArray("sections"),
                    "id", "source_section_id", "song_id", "generation_run_id", "name", "section_type",
                    "ordinal", "start_bar", "end_bar", "energy", "density_target", "payoff_role", "section_json");

                upsertArray(db, "tracks", record.optJSONArray("tracks"),
                    "id", "song_id", "generation_run_id", "role", "instrument_name", "midi_channel",
                    "midi_program", "octave_center", "min_pitch", "max_pitch", "muted", "soloed", "track_json");

                upsertArray(db, "musical_events", record.optJSONArray("musicalEvents"),
                    "id", "track_id", "section_id", "event_type", "start_beat", "duration_beats",
                    "pitch", "velocity", "probability", "articulation", "microtiming_ms",
                    "source", "locked", "event_json");

                insertArray(db, "generation_stages", record.optJSONArray("stages"),
                    "generation_run_id", "stage", "stage_order", "started_at", "completed_at",
                    "duration_ms", "status", "details_json");

                insertArray(db, "debugger_events", record.optJSONArray("debuggerEvents"),
                    "generation_run_id", "song_id", "severity", "subsystem", "code",
                    "message", "context_json", "occurred_at");

                upsertArray(db, "quality_evaluations", record.optJSONArray("qualityEvaluations"),
                    "id", "generation_run_id", "evaluation_phase", "overall_score", "harmony_score",
                    "groove_score", "structure_score", "density_score", "register_score", "melody_score",
                    "ensemble_score", "transition_score", "novelty_score", "genre_authenticity_score",
                    "preview_export_parity_score", "passed", "weaknesses_json", "evaluation_json");

                upsertArray(db, "candidate_results", record.optJSONArray("candidateResults"),
                    "id", "generation_run_id", "candidate_index", "seed", "score", "accepted",
                    "rejection_reason", "metrics_json", "candidate_json");

                upsertArray(db, "repair_actions", record.optJSONArray("repairActions"),
                    "id", "generation_run_id", "quality_evaluation_id", "target_scope", "target_id",
                    "repair_type", "before_metrics_json", "repair_json", "after_metrics_json", "accepted");

                db.setTransactionSuccessful();
                return new PersistResult(songId, runId);
            } finally {
                db.endTransaction();
            }
        }

        JSArray recentDebuggerEvents(int limit) {
            JSArray rows = new JSArray();
            SQLiteDatabase db = getReadableDatabase();
            String sql = "SELECT id, generation_run_id, song_id, severity, subsystem, code, " +
                "message, context_json, occurred_at FROM debugger_events " +
                "ORDER BY occurred_at DESC, id DESC LIMIT ?";
            try (Cursor cursor = db.rawQuery(sql, new String[] { String.valueOf(limit) })) {
                while (cursor.moveToNext()) {
                    JSObject row = new JSObject();
                    putCursor(row, cursor, "id");
                    putCursor(row, cursor, "generation_run_id");
                    putCursor(row, cursor, "song_id");
                    putCursor(row, cursor, "severity");
                    putCursor(row, cursor, "subsystem");
                    putCursor(row, cursor, "code");
                    putCursor(row, cursor, "message");
                    putCursor(row, cursor, "context_json");
                    putCursor(row, cursor, "occurred_at");
                    rows.put(row);
                }
            }
            return rows;
        }

        JSArray recentRuns(int limit) {
            JSArray rows = new JSArray();
            SQLiteDatabase db = getReadableDatabase();
            String sql = "SELECT gr.id, gr.song_id, gr.kind, gr.genre, gr.seed, gr.runtime_ms, " +
                "gr.outcome, gr.completed_at, s.title, qe.overall_score, qe.groove_score, " +
                "qe.harmony_score, qe.structure_score " +
                "FROM generation_runs gr " +
                "JOIN songs s ON s.id = gr.song_id " +
                "LEFT JOIN quality_evaluations qe ON qe.generation_run_id = gr.id " +
                "ORDER BY COALESCE(gr.completed_at, gr.started_at) DESC LIMIT ?";
            try (Cursor cursor = db.rawQuery(sql, new String[] { String.valueOf(limit) })) {
                while (cursor.moveToNext()) {
                    JSObject row = new JSObject();
                    putCursor(row, cursor, "id");
                    putCursor(row, cursor, "song_id");
                    putCursor(row, cursor, "kind");
                    putCursor(row, cursor, "genre");
                    putCursor(row, cursor, "seed");
                    putCursor(row, cursor, "runtime_ms");
                    putCursor(row, cursor, "outcome");
                    putCursor(row, cursor, "completed_at");
                    putCursor(row, cursor, "title");
                    putCursor(row, cursor, "overall_score");
                    putCursor(row, cursor, "groove_score");
                    putCursor(row, cursor, "harmony_score");
                    putCursor(row, cursor, "structure_score");
                    rows.put(row);
                }
            }
            return rows;
        }

        private JSObject requiredObject(JSObject parent, String key) {
            JSONObject object = parent.optJSONObject(key);
            if (object == null) throw new IllegalArgumentException("Missing generation record object: " + key);
            return cloneObject(object);
        }

        private JSObject cloneObject(JSONObject object) {
            try {
                return JSObject.fromJSONObject(object);
            } catch (Exception error) {
                throw new IllegalArgumentException("Invalid generation record object.", error);
            }
        }

        private String requiredText(JSObject object, String key) {
            String value = object.getString(key, null);
            if (value == null || value.trim().isEmpty()) {
                throw new IllegalArgumentException("Missing required generation field: " + key);
            }
            return value;
        }

        private boolean rowExists(SQLiteDatabase db, String table, String id) {
            try (Cursor cursor = db.query(table, new String[] { "id" }, "id = ?", new String[] { id }, null, null, null, "1")) {
                return cursor.moveToFirst();
            }
        }

        private void upsertOptional(SQLiteDatabase db, String table, JSONObject object, String... columns) {
            if (object == null) return;
            upsert(db, table, object, columns);
        }

        private void upsertArray(SQLiteDatabase db, String table, JSONArray array, String... columns) {
            if (array == null) return;
            for (int index = 0; index < array.length(); index++) {
                JSONObject object = array.optJSONObject(index);
                if (object != null) upsert(db, table, object, columns);
            }
        }

        private void insertArray(SQLiteDatabase db, String table, JSONArray array, String... columns) {
            if (array == null) return;
            db.delete(table, "generation_run_id = ?", new String[] {
                array.length() > 0 && array.optJSONObject(0) != null
                    ? array.optJSONObject(0).optString("generation_run_id", "")
                    : ""
            });
            for (int index = 0; index < array.length(); index++) {
                JSONObject object = array.optJSONObject(index);
                if (object == null) continue;
                db.insertOrThrow(table, null, values(object, columns));
            }
        }

        private void upsert(SQLiteDatabase db, String table, JSONObject object, String... columns) {
            ContentValues values = values(object, columns);
            long result = db.insertWithOnConflict(table, null, values, SQLiteDatabase.CONFLICT_REPLACE);
            if (result == -1) throw new IllegalStateException("Could not persist " + table + ".");
        }

        private ContentValues values(JSONObject object, String... columns) {
            ContentValues values = new ContentValues();
            for (String column : columns) {
                if (!object.has(column) || object.isNull(column)) continue;
                Object value = object.opt(column);
                if (value instanceof Boolean) values.put(column, ((Boolean) value) ? 1 : 0);
                else if (value instanceof Integer) values.put(column, (Integer) value);
                else if (value instanceof Long) values.put(column, (Long) value);
                else if (value instanceof Double) values.put(column, (Double) value);
                else if (value instanceof Float) values.put(column, (Float) value);
                else if (value instanceof Number) values.put(column, ((Number) value).doubleValue());
                else values.put(column, String.valueOf(value));
            }
            return values;
        }

        private void putCursor(JSObject target, Cursor cursor, String column) {
            int index = cursor.getColumnIndex(column);
            if (index < 0 || cursor.isNull(index)) {
                target.put(column, JSONObject.NULL);
                return;
            }
            switch (cursor.getType(index)) {
                case Cursor.FIELD_TYPE_INTEGER:
                    target.put(column, cursor.getLong(index));
                    break;
                case Cursor.FIELD_TYPE_FLOAT:
                    target.put(column, cursor.getDouble(index));
                    break;
                default:
                    target.put(column, cursor.getString(index));
                    break;
            }
        }
    }
}
