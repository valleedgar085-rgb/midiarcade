const storageGenerations = new Map();

function currentGeneration(key) {
  return storageGenerations.get(key) ?? 0;
}

export function createSessionStorage({
  key,
  schema,
  storageProvider = () => globalThis.localStorage,
} = {}) {
  if (!key) throw new TypeError("session storage requires a key");
  let generation = currentGeneration(key);

  function storage() {
    try {
      return storageProvider?.() ?? null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    load() {
      const target = storage();
      if (!target) return { status: "unavailable", value: null };
      try {
        const serialized = target.getItem(key);
        if (!serialized) return { status: "empty", value: null };
        const value = JSON.parse(serialized);
        if (!value || value.schema !== schema) return { status: "invalid", value: null };
        return { status: "ready", value };
      } catch (error) {
        return { status: "invalid", value: null, error };
      }
    },
    save(value) {
      const target = storage();
      if (!target) return { ok: false, reason: "unavailable" };
      if (generation !== currentGeneration(key)) {
        return { ok: false, reason: "stale-session" };
      }
      try {
        target.setItem(key, JSON.stringify(value));
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: "write-failed", error };
      }
    },
    discard() {
      const target = storage();
      if (!target) return false;
      try {
        target.removeItem(key);
        generation = currentGeneration(key) + 1;
        storageGenerations.set(key, generation);
        return true;
      } catch {
        return false;
      }
    },
  });
}
