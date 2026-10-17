// Explicit on-device projects are separate from preference autosave.
// Never auto-restore an old song at startup: users choose which project to open.
export const PROJECT_SCHEMA = 1;
export const PROJECT_DB_NAME = "midi-arcade-projects-v1";
const STORE = "projects";
const MAX_JSON_BYTES = 10 * 1024 * 1024;
const MAX_NOTES = 50000;
const MAX_TRACKS = 32;
const MAX_PROJECTS = 60;

function checksum(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function projectName(value) {
  const title = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 72);
  return title || "Untitled idea";
}

function validNotes(track) {
  const notes = Array.isArray(track?.notes) ? track.notes
    : Array.isArray(track?.events) ? track.events.filter((event) => event?.pitch != null || event?.note != null || event?.midi != null)
    : [];
  return notes;
}

export function validateProjectSong(song) {
  if (!song || typeof song !== "object" || Array.isArray(song)) return false;
  const tracks = Array.isArray(song.tracks) ? song.tracks : song.renderedTracks;
  if (!Array.isArray(tracks) || !tracks.length || tracks.length > MAX_TRACKS) return false;
  let count = 0;
  for (const track of tracks) {
    if (!track || typeof track !== "object") return false;
    const notes = validNotes(track);
    if (!Array.isArray(notes)) return false;
    count += notes.length;
    if (count > MAX_NOTES) return false;
    for (const note of notes) {
      const pitch = Number(note?.pitch ?? note?.note ?? note?.midi);
      const start = Number(note?.start ?? note?.tick ?? note?.startTick ?? note?.time);
      const duration = Number(note?.duration ?? note?.durationTicks ?? note?.length ?? note?.ticks);
      if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127
        || !Number.isFinite(start) || start < 0
        || !Number.isFinite(duration) || duration <= 0) return false;
      const velocity = note?.velocity ?? note?.vel;
      if (velocity != null && (!Number.isFinite(Number(velocity)) || Number(velocity) < 0 || Number(velocity) > 127)) return false;
    }
  }
  return count > 0;
}

export function makeProjectRecord({
  id, name, song, trackSettings = {}, muted = [], solo = [], locked = [], selectedTrack = "drums",
} = {}, { now = () => new Date().toISOString() } = {}) {
  if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(String(id ?? ""))) throw new TypeError("Invalid project identifier");
  if (!validateProjectSong(song)) throw new TypeError("A valid, nonempty song is required");
  // JSON roundtrip strips runtime object identities. It also exposes invalid
  // serialization before anything is written into the project library.
  const payload = JSON.parse(JSON.stringify({
    song, trackSettings, muted: [...muted], solo: [...solo], locked: [...locked], selectedTrack,
  }));
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_JSON_BYTES || !validateProjectSong(payload.song)) {
    throw new TypeError("Project is too large or contains invalid notes");
  }
  const savedAt = String(now());
  if (!Number.isFinite(Date.parse(savedAt))) throw new TypeError("Invalid project timestamp");
  return Object.freeze({
    schema: PROJECT_SCHEMA,
    id: String(id),
    name: projectName(name),
    savedAt,
    checksum: checksum(serialized),
    payload,
  });
}

export function validateProjectRecord(value) {
  if (!value || value.schema !== PROJECT_SCHEMA
    || !/^[a-zA-Z0-9:_-]{1,100}$/.test(String(value.id ?? ""))
    || typeof value.name !== "string" || !value.name.trim() || value.name.length > 72
    || !Number.isFinite(Date.parse(value.savedAt))
    || !value.payload || typeof value.payload !== "object") return false;
  try {
    const serialized = JSON.stringify(value.payload);
    if (serialized.length > MAX_JSON_BYTES || checksum(serialized) !== value.checksum) return false;
    if (!validateProjectSong(value.payload.song)) return false;
    if (!value.payload.trackSettings || typeof value.payload.trackSettings !== "object") return false;
    for (const key of ["muted", "solo", "locked"]) {
      if (!Array.isArray(value.payload[key]) || value.payload[key].length > MAX_TRACKS
        || value.payload[key].some((id) => typeof id !== "string" || id.length > 64)) return false;
    }
    return typeof value.payload.selectedTrack === "string" && value.payload.selectedTrack.length < 64;
  } catch {
    return false;
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Project storage failed"));
  });
}

export function createProjectLibrary({ indexedDBProvider = () => globalThis.indexedDB } = {}) {
  let databasePromise = null;
  function database() {
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        let factory;
        try { factory = indexedDBProvider(); } catch { /* unavailable */ }
        if (!factory?.open) { reject(new Error("Local project storage is unavailable on this device")); return; }
        const req = factory.open(PROJECT_DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
        };
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => db.close();
          resolve(db);
        };
        req.onerror = () => reject(req.error ?? new Error("Cannot open the project library"));
        req.onblocked = () => reject(new Error("Project library is busy in another tab"));
      }).catch((error) => {
        databasePromise = null;
        throw error;
      });
    }
    return databasePromise;
  }

  async function transaction(mode, operation) {
    const db = await database();
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(STORE, mode); } catch (error) { reject(error); return; }
      let result;
      try { result = operation(tx.objectStore(STORE)); } catch (error) { tx.abort(); reject(error); return; }
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error ?? new Error("Project operation was canceled"));
      tx.onerror = () => reject(tx.error ?? new Error("Project storage failed"));
    });
  }

  return Object.freeze({
    async list() {
      const db = await database();
      const records = await requestResult(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
      return records.map((entry) => ({
        id: typeof entry?.id === "string" ? entry.id : "",
        name: typeof entry?.name === "string" && entry.name.trim() ? entry.name : "Damaged project",
        savedAt: typeof entry?.savedAt === "string" && Number.isFinite(Date.parse(entry.savedAt))
          ? entry.savedAt : "1970-01-01T00:00:00.000Z",
        valid: validateProjectRecord(entry),
      })).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, MAX_PROJECTS);
    },
    async save(record) {
      if (!validateProjectRecord(record)) throw new TypeError("Invalid project snapshot");
      const records = await this.list();
      if (records.length >= MAX_PROJECTS && !records.some((item) => item.id === record.id)) {
        throw new Error("Project library is full. Delete an older project first.");
      }
      await transaction("readwrite", (store) => { store.put(record); });
      return record.id;
    },
    async load(id) {
      const db = await database();
      const record = await requestResult(db.transaction(STORE, "readonly").objectStore(STORE).get(String(id)));
      if (!record) throw new Error("Project not found");
      if (!validateProjectRecord(record)) throw new Error("Project failed integrity checks; current song was not changed");
      return record;
    },
    async remove(id) {
      await transaction("readwrite", (store) => { store.delete(String(id)); });
      return true;
    },
  });
}
