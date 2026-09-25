import { qualityStageAuthority } from "./generation-repair-router.js";

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function normalizedTracks(song) {
  return [...(song?.tracks ?? [])]
    .map((track) => ({
      id: String(track?.id ?? ""),
      notes: [...(track?.notes ?? [])]
        .map((note) => ({
          start: round(note?.start),
          duration: round(note?.duration),
          pitch: Math.round(finite(note?.pitch, 60)),
        }))
        .sort((left, right) => (
          left.start - right.start
          || left.pitch - right.pitch
          || left.duration - right.duration
        )),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function signatures(song) {
  const tracks = normalizedTracks(song);
  const map = new Map(tracks.map((track) => [track.id, track.notes]));
  const ids = tracks.map((track) => track.id);
  return {
    ids,
    counts: Object.fromEntries(ids.map((id) => [id, map.get(id)?.length ?? 0])),
    starts: Object.fromEntries(ids.map((id) => [id, (map.get(id) ?? []).map((note) => note.start)])),
    durations: Object.fromEntries(ids.map((id) => [id, (map.get(id) ?? []).map((note) => note.duration)])),
    pitchClasses: Object.fromEntries(ids.map((id) => [id, (map.get(id) ?? []).map((note) => ((note.pitch % 12) + 12) % 12)])),
    pitches: Object.fromEntries(ids.map((id) => [id, (map.get(id) ?? []).map((note) => note.pitch)])),
  };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Read-only note-mutation audit for debug/test visibility.
 * It never blocks a quality candidate; release/critic gates still decide whether
 * the candidate is accepted. Unauthorized changes are surfaced explicitly.
 */
export function auditStageMutationAuthority(beforeSong, afterSong, stageId) {
  const authority = qualityStageAuthority(stageId);
  if (!beforeSong || !afterSong || beforeSong === afterSong) {
    return Object.freeze({
      ...authority,
      changed: false,
      changedMutations: Object.freeze([]),
      violations: Object.freeze([]),
      passed: true,
    });
  }

  const before = signatures(beforeSong);
  const after = signatures(afterSong);
  const topologyChanged = !same(before.counts, after.counts) || !same(before.ids, after.ids);
  const changed = [];
  if (topologyChanged) changed.push("topology");
  if (!same(before.starts, after.starts)) changed.push("timing");
  if (!same(before.durations, after.durations)) changed.push("duration");

  // Once topology changes, a one-to-one pitch comparison is not reliable.
  if (!topologyChanged) {
    const harmonyChanged = !same(before.pitchClasses, after.pitchClasses);
    const pitchChanged = !same(before.pitches, after.pitches);
    if (harmonyChanged) changed.push("harmony");
    else if (pitchChanged) changed.push("register");
  }

  const violations = authority.automationOnly && changed.length
    ? [...changed]
    : changed.filter((mutation) => !authority.mutations.includes(mutation));

  return Object.freeze({
    ...authority,
    changed: changed.length > 0,
    changedMutations: Object.freeze(changed),
    violations: Object.freeze(violations),
    passed: violations.length === 0,
  });
}
