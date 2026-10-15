import { cloneValue } from "./clone-value.js";

/**
 * Canonical musical authorities for an accepted MIDI Arcade song.
 *
 * These values describe the musical world that scoped regeneration must obey.
 * Notes may change inside the requested scope, but the accepted song's shared
 * structure, harmony, groove, and coordination contracts stay authoritative.
 */
export const CANONICAL_SONG_AUTHORITY_KEYS = Object.freeze([
  "structure",
  "sections",
  "harmony",
  "songBlueprint",
  "songPlan",
  "grooveConductor",
  "generationInterlock",
  "performanceProfile",
  "songDNA",
  "motifs",
  "phraseMemory",
  "orchestrationMatrix",
  "producerIntent",
]);

/**
 * Authorities the Composer must actually use while producing scoped notes.
 * Later accepted-state guards cover the broader list above; these are the
 * contracts whose divergence can make newly generated notes musically wrong
 * even when the old metadata is spliced back afterward.
 */
export const SCOPED_COMPOSER_AUTHORITY_KEYS = Object.freeze([
  "structure",
  "sections",
  "harmony",
  "songBlueprint",
  "songPlan",
  "grooveConductor",
]);

/** Freeze the cloned authority graph, never the accepted source song. */
function freezeAuthorityGraph(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;
  seen.add(value);
  for (const key of Object.keys(value)) freezeAuthorityGraph(value[key], seen);
  return Object.freeze(value);
}

export function createCanonicalSongState(song) {
  if (!song || typeof song !== "object") {
    throw new TypeError("createCanonicalSongState requires a song object");
  }

  const state = {
    version: 1,
    sourceSongId: song.id ?? null,
    sourceSeed: song.seed ?? null,
  };

  for (const key of CANONICAL_SONG_AUTHORITY_KEYS) {
    if (song[key] !== undefined) state[key] = cloneValue(song[key]);
  }

  return freezeAuthorityGraph(state);
}
