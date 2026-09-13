import { applyElementSoundProfile } from "./elemental-sound-profile.js";

function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  const fallback = Number.isFinite(numeric) ? numeric : min;
  return Math.min(max, Math.max(min, fallback));
}

function trackId(track, index) {
  return String(track?.id ?? track?.name ?? ["drums", "bass", "chords", "melody", "counterpoint", "pad"][index] ?? `track-${index}`);
}

function elementFromSong(song) {
  return song?.variationSet?.element ?? song?.elementLineage?.element ?? null;
}

function moodFromSong(song) {
  return song?.variationSet?.moodIntent ?? song?.elementLineage?.moodIntent ?? null;
}

function copyElement(element, intensity) {
  if (!element?.id) return null;
  return Object.freeze({
    id: String(element.id),
    label: element.label ?? String(element.id),
    symbol: element.symbol ?? "",
    description: element.description ?? "",
    intensity: Number(clamp(intensity).toFixed(4)),
    ...(element.meter ? { meter: { ...element.meter } } : {}),
  });
}

function copyMood(mood) {
  if (!mood?.id) return null;
  return Object.freeze({
    id: String(mood.id),
    label: mood.label ?? String(mood.id),
    description: mood.description ?? "",
  });
}

function preserveSourcePrograms(sourceSong, generatedSong) {
  if (!Array.isArray(sourceSong?.tracks) || !Array.isArray(generatedSong?.tracks)) return generatedSong;
  const sourceById = new Map(sourceSong.tracks.map((track, index) => [trackId(track, index), track]));
  generatedSong.tracks.forEach((track, index) => {
    const id = trackId(track, index);
    const sourceTrack = sourceById.get(id) ?? sourceSong.tracks[index];
    const program = Number(sourceTrack?.program ?? sourceTrack?.settings?.program ?? sourceTrack?.controls?.program);
    if (!Number.isFinite(program) || program < 0 || program > 127) return;
    track.program = program;
    track.settings = { ...(track.settings ?? track.controls ?? {}), program };
  });
  return generatedSong;
}

export function resolveSongElement(song) {
  return elementFromSong(song);
}

/**
 * Continue the selected elemental interpretation through More Like This.
 * The Similar composition may evolve notes and arrangement, but it keeps the
 * selected element's production identity, program family, mood provenance, and
 * bounded tone signature. This makes Fire -> Similar remain Fire-family rather
 * than silently collapsing back to a generic production pass.
 */
export function continueElementLineage(sourceSong, generatedSong) {
  if (!generatedSong) return generatedSong;
  const sourceElement = elementFromSong(sourceSong);
  if (!sourceElement?.id) return generatedSong;

  const intensity = clamp(sourceElement.intensity ?? sourceSong?.elementSound?.intensity ?? 0.75);
  const sourceMood = moodFromSong(sourceSong);
  const previousLineage = sourceSong?.elementLineage;
  const rootFamilyId = sourceSong?.variationSet?.id
    ?? previousLineage?.rootFamilyId
    ?? null;

  // Similar should be a descendant, not masquerade as one of the original
  // three sibling cards.
  delete generatedSong.variationSet;

  preserveSourcePrograms(sourceSong, generatedSong);
  applyElementSoundProfile(generatedSong, sourceElement.id, intensity);

  generatedSong.elementLineage = Object.freeze({
    version: 1,
    depth: Math.max(1, Number(previousLineage?.depth ?? 0) + 1),
    parentSongId: sourceSong?.id ?? null,
    rootFamilyId,
    element: copyElement(sourceElement, intensity),
    moodIntent: copyMood(sourceMood),
  });

  return generatedSong;
}
