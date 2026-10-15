/**
 * Read-only development measurement of *activity* between song sections.
 * The older ensemble roster metric only checks whether a track has any notes,
 * so a constantly present instrument can falsely look creatively static.
 *
 * This module is intentionally outside src/ and never ships in the APK.
 * Values are relative diagnostics for matched song/seed comparisons, not
 * perceptual loudness, musical-quality scores, or release-gate thresholds.
 */
const TRACKS = Object.freeze(["drums", "bass", "chords", "melody", "counterpoint", "pad"]);
const EPSILON = 1e-8;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value, digits = 4) => Number(value.toFixed(digits));

function sectionBounds(section, beatsPerBar) {
  const start = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const end = Math.max(start + 0.25, finite(
    section?.endBeat, start + Math.max(1, finite(section?.bars, 1)) * beatsPerBar,
  ));
  return { start, end, bars: Math.max(0.0625, (end - start) / beatsPerBar) };
}

function noteStart(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time, NaN);
}

function noteDuration(note) {
  return Math.max(0, finite(note?.duration ?? note?.durationBeats ?? note?.length, 0.25));
}

function coveredFraction(notes, start, end) {
  const intervals = notes.map((note) => ([
    Math.max(start, noteStart(note)),
    Math.min(end, noteStart(note) + noteDuration(note)),
  ])).filter(([a, b]) => Number.isFinite(a) && b > a)
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  let cursor = start;
  let covered = 0;
  for (const [a, b] of intervals) {
    if (b <= cursor) continue;
    covered += b - Math.max(a, cursor);
    cursor = b;
  }
  return clamp(covered / Math.max(EPSILON, end - start));
}

function trackActivity(notes, bounds) {
  const spanning = (notes ?? []).filter((note) => {
    const onset = noteStart(note);
    return Number.isFinite(onset) && onset < bounds.end - EPSILON
      && onset + noteDuration(note) > bounds.start + EPSILON;
  });
  const attacks = spanning.filter((note) => noteStart(note) >= bounds.start - EPSILON);
  const attacksPerBar = attacks.length / bounds.bars;
  const coverage = coveredFraction(spanning, bounds.start, bounds.end);
  const velocity = attacks.length
    ? clamp(attacks.reduce((sum, note) => sum + clamp(finite(note.velocity, 85) / 127), 0) / attacks.length)
    : 0;
  // Bounded attack-density proxy. All coefficients are exploratory and the
  // number must never be described as a mastered volume or subjective score.
  const attackActivity = 1 - Math.exp(-attacksPerBar / 2);
  const activity = spanning.length
    ? 0.55 * attackActivity + 0.30 * coverage + 0.15 * velocity
    : 0;
  return Object.freeze({
    attacks: attacks.length,
    attacksPerBar: round(attacksPerBar),
    coverage: round(coverage),
    averageVelocity: attacks.length ? round(velocity) : null,
    activity: round(activity),
    active: spanning.length > 0,
  });
}

function setDistance(a, b) {
  const set = new Set([...a, ...b]);
  if (!set.size) return 0;
  return 1 - [...set].filter((id) => a.includes(id) && b.includes(id)).length / set.size;
}

export function evaluateArrangementActivityContrast(song) {
  const sections = Array.isArray(song?.structure) ? song.structure : (song?.sections ?? []);
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const tracks = new Map((song?.tracks ?? []).map((track) => [String(track?.id ?? ""), track?.notes ?? []]));
  const measures = sections.map((section, index) => {
    const bounds = sectionBounds(section, beatsPerBar);
    const lanes = Object.fromEntries(TRACKS.map((id) => [id, trackActivity(tracks.get(id), bounds)]));
    const activeTracks = TRACKS.filter((id) => lanes[id].active);
    return Object.freeze({
      sectionId: String(section?.id ?? ("section-" + index)),
      name: String(section?.name ?? section?.type ?? ""),
      bars: round(bounds.bars, 2),
      activeTracks: Object.freeze(activeTracks),
      lanes: Object.freeze(lanes),
    });
  });
  const transitions = measures.slice(1).map((next, index) => {
    const prior = measures[index];
    const delta = TRACKS.reduce((sum, id) => sum + Math.abs(next.lanes[id].activity - prior.lanes[id].activity), 0);
    const available = TRACKS.reduce((sum, id) => sum + Math.max(next.lanes[id].activity, prior.lanes[id].activity), 0);
    const contrast = available > EPSILON ? delta / available : 0;
    const byTrack = Object.fromEntries(TRACKS.map((id) =>
      [id, round(next.lanes[id].activity - prior.lanes[id].activity)]));
    return Object.freeze({
      fromSectionId: prior.sectionId,
      toSectionId: next.sectionId,
      activityContrast: round(contrast),
      rosterChange: round(setDistance(prior.activeTracks, next.activeTracks)),
      byTrack: Object.freeze(byTrack),
    });
  });
  const mean = transitions.length
    ? transitions.reduce((total, value) => total + value.activityContrast, 0) / transitions.length
    : null;
  const leastChange = [...transitions].sort((a, b) =>
    a.activityContrast - b.activityContrast || a.fromSectionId.localeCompare(b.fromSectionId))[0] ?? null;
  return Object.freeze({
    version: 1,
    mode: "read-only",
    status: transitions.length ? "evaluated" : "insufficient-sections",
    tracks: TRACKS,
    sectionCount: measures.length,
    meanActivityContrast: mean == null ? null : round(mean),
    leastContrastingTransition: leastChange,
    sections: Object.freeze(measures),
    transitions: Object.freeze(transitions),
  });
}
