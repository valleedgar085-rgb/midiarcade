const DEFAULT_DB_NAME = "midi-arcade-history";
const DEFAULT_STORE_NAME = "generationSnapshots";
const DEFAULT_VERSION = 1;

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openIndexedDb(indexedDb, dbName, storeName, version) {
  if (!indexedDb || typeof indexedDb.open !== "function") {
    return Promise.reject(new Error("IndexedDB is unavailable"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(dbName, version);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: "runId" });
        store.createIndex("songId", "songId", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export function createIndexedDbGenerationStore({
  indexedDb = globalThis.indexedDB,
  dbName = DEFAULT_DB_NAME,
  storeName = DEFAULT_STORE_NAME,
  version = DEFAULT_VERSION,
  databaseProvider = null,
  clock = () => Date.now(),
} = {}) {
  let databasePromise = null;

  async function database() {
    if (!databasePromise) {
      databasePromise = typeof databaseProvider === "function"
        ? Promise.resolve(databaseProvider())
        : openIndexedDb(indexedDb, dbName, storeName, version);
    }
    return databasePromise;
  }

  async function initialize() {
    await database();
    return { ok: true, version };
  }

  async function saveGenerationSnapshot(snapshot) {
    if (!snapshot?.run?.id) throw new TypeError("generation snapshot requires a run");
    const db = await database();
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.put({
      runId: snapshot.run.id,
      songId: snapshot.run.songId,
      savedAt: Number(clock()),
      snapshot,
    });
    await transactionDone(transaction);
    return {
      ok: true,
      runId: snapshot.run.id,
      counts: {
        sections: snapshot.sections?.length ?? 0,
        tracks: snapshot.tracks?.length ?? 0,
        musicalEvents: snapshot.musicalEvents?.length ?? 0,
      },
    };
  }

  return Object.freeze({
    initialize,
    saveGenerationSnapshot,
  });
}
