import { databaseMigrationPlan } from "./database-schema.js";

function json(value) {
  return JSON.stringify(value ?? null);
}

function userVersion(rows = []) {
  const first = Array.isArray(rows) ? rows[0] : null;
  const raw = first?.user_version ?? first?.userVersion ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

async function initializeSchema(connection) {
  const versionResult = await connection.query("PRAGMA user_version;");
  const currentVersion = userVersion(versionResult?.values ?? versionResult);
  const migrations = databaseMigrationPlan(currentVersion);
  for (const migration of migrations) {
    await connection.execute(migration.sql, false);
    await connection.execute(`PRAGMA user_version = ${migration.version};`, false);
  }
  return migrations.length ? migrations.at(-1).version : currentVersion;
}

async function insertRun(connection, run) {
  await connection.run(
    `INSERT OR REPLACE INTO generation_runs
      (id, song_id, kind, seed, genre, requested_bars, engine_version, started_at, completed_at, config_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      run.id,
      run.songId,
      run.kind,
      run.seed,
      run.genre,
      run.requestedBars,
      run.engineVersion,
      run.startedAt,
      run.completedAt,
      json(run.config),
    ],
    false,
  );
}

async function insertOptionalAuthority(connection, table, row, payloadColumn, payload) {
  if (!row) return;
  const columns = table === "groove_dna"
    ? "(id, generation_run_id, genre, subdivision, groove_json)"
    : `(id, generation_run_id, ${payloadColumn})`;
  const placeholders = table === "groove_dna"
    ? "(?, ?, ?, ?, ?)"
    : "(?, ?, ?)";
  const values = table === "groove_dna"
    ? [row.id, row.generationRunId, row.genre, row.subdivision, json(payload)]
    : [row.id, row.generationRunId, json(payload)];
  await connection.run(
    `INSERT OR REPLACE INTO ${table} ${columns} VALUES ${placeholders};`,
    values,
    false,
  );
}

async function replaceChildren(connection, snapshot) {
  await connection.run("DELETE FROM musical_events WHERE track_id IN (SELECT id FROM tracks WHERE generation_run_id = ?);", [snapshot.run.id], false);
  await connection.run("DELETE FROM tracks WHERE generation_run_id = ?;", [snapshot.run.id], false);
  await connection.run("DELETE FROM sections WHERE generation_run_id = ?;", [snapshot.run.id], false);

  for (const section of snapshot.sections ?? []) {
    await connection.run(
      `INSERT INTO sections
        (id, generation_run_id, section_id, ordinal, section_json)
       VALUES (?, ?, ?, ?, ?);`,
      [section.id, section.generationRunId, section.sectionId, section.ordinal, json(section.section)],
      false,
    );
  }

  for (const track of snapshot.tracks ?? []) {
    await connection.run(
      `INSERT INTO tracks
        (id, generation_run_id, role, track_json)
       VALUES (?, ?, ?, ?);`,
      [track.id, track.generationRunId, track.role, json(track.track)],
      false,
    );
  }

  for (const event of snapshot.musicalEvents ?? []) {
    await connection.run(
      `INSERT INTO musical_events
        (id, track_id, start_beat, duration_beats, pitch, velocity, event_json)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        event.id,
        event.trackId,
        event.startBeat,
        event.durationBeats,
        event.pitch,
        event.velocity,
        json(event.event),
      ],
      false,
    );
  }
}

export function createSqliteGenerationStore({ connection } = {}) {
  if (!connection) throw new TypeError("sqlite generation store requires a connection");
  for (const method of ["query", "execute", "run", "beginTransaction", "commitTransaction", "rollbackTransaction"]) {
    if (typeof connection[method] !== "function") {
      throw new TypeError(`sqlite generation store requires connection.${method}()`);
    }
  }

  let initialized = false;

  async function initialize() {
    if (initialized) return { ok: true, alreadyInitialized: true };
    const version = await initializeSchema(connection);
    initialized = true;
    return { ok: true, version };
  }

  async function saveGenerationSnapshot(snapshot) {
    if (!snapshot?.run?.id) throw new TypeError("generation snapshot requires a run");
    await initialize();
    await connection.beginTransaction();
    try {
      await insertRun(connection, snapshot.run);
      await insertOptionalAuthority(connection, "song_blueprints", snapshot.blueprint, "blueprint_json", snapshot.blueprint?.blueprint);
      await insertOptionalAuthority(connection, "groove_dna", snapshot.grooveDna, "groove_json", snapshot.grooveDna?.groove);
      await insertOptionalAuthority(connection, "harmony_timelines", snapshot.harmony, "harmony_json", snapshot.harmony?.harmony);
      await replaceChildren(connection, snapshot);
      await connection.commitTransaction();
      return {
        ok: true,
        runId: snapshot.run.id,
        counts: {
          sections: snapshot.sections?.length ?? 0,
          tracks: snapshot.tracks?.length ?? 0,
          musicalEvents: snapshot.musicalEvents?.length ?? 0,
        },
      };
    } catch (error) {
      try {
        await connection.rollbackTransaction();
      } catch {
        // Preserve the original write error. The caller receives the failure.
      }
      throw error;
    }
  }

  return Object.freeze({
    initialize,
    saveGenerationSnapshot,
  });
}
