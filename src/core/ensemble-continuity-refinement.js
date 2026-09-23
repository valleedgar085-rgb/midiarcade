import { cloneValue } from "./clone-value.js";

export const MAX_ENSEMBLE_CONTINUITY_CANDIDATES = 3;
export const ENSEMBLE_CONTINUITY_TRACKS = Object.freeze(["drums", "chords", "counterpoint", "pad"]);
const LONG_SONG_ENSEMBLE_BARS = 32;
const SEVERE_ENSEMBLE_DEFICIT = 6;
const MAX_DEEP_ENSEMBLE_LINKS = 6;

const EXCLUDED_SECTION_NAMES = ["intro", "outro", "breakdown", "interlude"];

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function median(values, fallback = 0) {
  const clean = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!clean.length) return fallback;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function normalizeName(section) {
  return String(section?.name ?? section?.type ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isExcludedSectionName(name) {
  return EXCLUDED_SECTION_NAMES.some((excluded) => name === excluded || name.startsWith(excluded));
}

function sectionBounds(song, section, index) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const bars = Math.max(1, finite(
    section?.bars,
    (finite(section?.endBeat, startBeat + beatsPerBar) - startBeat) / beatsPerBar,
  ));
  const endBeat = Math.max(startBeat + 0.25, finite(section?.endBeat, startBeat + bars * beatsPerBar));
  const name = normalizeName(section);
  return {
    section,
    index,
    id: String(section?.id ?? `${name || "section"}-${index + 1}`),
    name,
    startBeat,
    endBeat,
    bars,
    beatsPerBar,
  };
}

function track(song, id) {
  return (song?.tracks ?? []).find((entry) => entry?.id === id) ?? null;
}

function roleFor(song, sectionId, trackId) {
  return String(
    song?.producerIntent?.scenes?.find((entry) => entry?.sectionId === sectionId)?.roles?.[trackId]
      ?? "support",
  );
}

function presenceFor(song, sectionId, trackId) {
  return finite(
    song?.orchestrationMatrix
      ?.find((entry) => entry?.sectionId === sectionId)
      ?.lanes?.[trackId]?.presence,
    1,
  );
}

function minimumPresence(trackId, role) {
  if (trackId === "counterpoint") {
    if (role === "foreground") return 0.24;
    if (role === "answer") return 0.28;
    return 0.36;
  }
  if (trackId === "pad") return role === "foreground" ? 0.36 : 0.42;
  return 0.46;
}

function eligibleSections(song, trackId) {
  const structure = Array.isArray(song?.structure) ? song.structure : song?.sections;
  if (!Array.isArray(structure)) return [];
  return structure
    .map((section, index) => sectionBounds(song, section, index))
    .map((bounds) => ({
      ...bounds,
      role: roleFor(song, bounds.id, trackId),
      presence: presenceFor(song, bounds.id, trackId),
    }))
    .filter(({ name, role, presence }) => (
      name
      && !isExcludedSectionName(name)
      && role !== "rest"
      && presence >= minimumPresence(trackId, role)
    ));
}

function attacksInSection(trackObject, bounds) {
  return (trackObject?.notes ?? [])
    .filter((note) => finite(note?.start) >= bounds.startBeat - 1e-6 && finite(note?.start) < bounds.endBeat - 1e-6)
    .sort((left, right) => finite(left?.start) - finite(right?.start) || finite(left?.pitch) - finite(right?.pitch));
}

function overlapsInSection(trackObject, bounds) {
  return (trackObject?.notes ?? [])
    .filter((note) => {
      const start = finite(note?.start);
      const end = start + Math.max(0.04, finite(note?.duration, 0.25));
      return start < bounds.endBeat - 1e-6 && end > bounds.startBeat + 1e-6;
    })
    .sort((left, right) => finite(left?.start) - finite(right?.start) || finite(left?.pitch) - finite(right?.pitch));
}

function silenceWindows(notes, bounds) {
  const windows = [];
  let cursor = bounds.startBeat;
  for (const note of notes) {
    const start = clamp(finite(note?.start), bounds.startBeat, bounds.endBeat);
    if (start - cursor >= 0.5) windows.push({ start: cursor, end: start, gap: start - cursor });
    const end = finite(note?.start) + Math.max(0.04, finite(note?.duration, 0.25));
    cursor = Math.max(cursor, Math.min(bounds.endBeat, end));
  }
  if (bounds.endBeat - cursor >= 0.5) windows.push({
    start: cursor,
    end: bounds.endBeat,
    gap: bounds.endBeat - cursor,
  });
  return windows.sort((left, right) => right.gap - left.gap || left.start - right.start);
}

function targetProfile(trackId, role, beatsPerBar, baselineRate) {
  const foreground = role === "foreground";
  const answer = role === "answer";
  if (trackId === "drums") {
    return {
      attacksPerBar: Math.max(1.6, Math.min(7, baselineRate * 0.46)),
      maxSilenceBeats: Math.max(1.5, beatsPerBar * 0.72),
    };
  }
  if (trackId === "chords") {
    return {
      attacksPerBar: Math.max(foreground ? 0.85 : 0.55, Math.min(2.5, baselineRate * 0.5)),
      maxSilenceBeats: beatsPerBar * (foreground ? 1.15 : 1.55),
    };
  }
  if (trackId === "counterpoint") {
    return {
      attacksPerBar: Math.max(foreground ? 1.05 : answer ? 0.68 : 0.42, Math.min(2.4, baselineRate * (foreground ? 0.64 : answer ? 0.52 : 0.44))),
      maxSilenceBeats: beatsPerBar * (foreground ? 1.15 : answer ? 1.55 : 1.75),
    };
  }
  return {
    attacksPerBar: Math.max(foreground ? 0.5 : 0.22, Math.min(1.4, baselineRate * 0.35)),
    maxSilenceBeats: beatsPerBar * (foreground ? 1.8 : 2.4),
  };
}

function rawMetrics(song, trackId, trackObject, bounds) {
  const attacks = attacksInSection(trackObject, bounds);
  const overlaps = overlapsInSection(trackObject, bounds);
  return {
    ...bounds,
    trackId,
    attacks,
    overlaps,
    attacksPerBar: attacks.length / Math.max(1, bounds.bars),
    windows: silenceWindows(overlaps, bounds),
  };
}

function continuityMetric(metric, baselineRate) {
  const target = targetProfile(metric.trackId, metric.role, metric.beatsPerBar, baselineRate);
  const maxSilenceBeats = metric.windows[0]?.gap ?? 0;
  const attackDeficit = Math.max(0, target.attacksPerBar - metric.attacksPerBar);
  const silenceDeficit = Math.max(0, maxSilenceBeats - target.maxSilenceBeats) / Math.max(1, metric.beatsPerBar);
  const missingPenalty = metric.attacks.length === 0 ? 0.72 : 0;
  return {
    ...metric,
    targetAttacksPerBar: target.attacksPerBar,
    targetMaxSilenceBeats: target.maxSilenceBeats,
    maxSilenceBeats,
    deficit: attackDeficit + silenceDeficit + missingPenalty,
  };
}

function analyzeTrack(song, trackId) {
  const trackObject = track(song, trackId);
  if (!trackObject) return { trackId, baselineAttacksPerBar: 0, sections: [], actionable: [] };
  const raw = eligibleSections(song, trackId).map((bounds) => rawMetrics(song, trackId, trackObject, bounds));
  const populated = raw.filter(({ attacks }) => attacks.length > 0).map(({ attacksPerBar }) => attacksPerBar);
  const fallback = trackId === "drums" ? 2 : trackId === "chords" ? 0.7 : trackId === "counterpoint" ? 0.5 : 0.3;
  const baselineAttacksPerBar = median(populated, fallback);
  const sections = raw.map((metric) => continuityMetric(metric, baselineAttacksPerBar));
  const actionable = sections
    .filter(({ windows, deficit }) => windows.length > 0 && deficit >= 0.3)
    .sort((left, right) => right.deficit - left.deficit || right.maxSilenceBeats - left.maxSilenceBeats || left.index - right.index);
  return { trackId, baselineAttacksPerBar, sections, actionable };
}

export function analyzeEnsembleContinuity(song) {
  const tracks = ENSEMBLE_CONTINUITY_TRACKS.map((trackId) => analyzeTrack(song, trackId));
  const actionable = tracks
    .flatMap((entry) => entry.actionable)
    .sort((left, right) => right.deficit - left.deficit || left.index - right.index || left.trackId.localeCompare(right.trackId));
  return Object.freeze({
    deficit: round(actionable.reduce((sum, entry) => sum + entry.deficit, 0), 4),
    weakestTrackId: actionable[0]?.trackId ?? null,
    weakestSectionId: actionable[0]?.id ?? null,
    tracks: tracks.map((entry) => Object.freeze({
      trackId: entry.trackId,
      baselineAttacksPerBar: round(entry.baselineAttacksPerBar, 3),
      sections: entry.sections.map((section) => Object.freeze({
        id: section.id,
        name: section.name,
        role: section.role,
        presence: round(section.presence, 3),
        attacksPerBar: round(section.attacksPerBar, 3),
        maxSilenceBeats: round(section.maxSilenceBeats, 3),
        targetAttacksPerBar: round(section.targetAttacksPerBar, 3),
        targetMaxSilenceBeats: round(section.targetMaxSilenceBeats, 3),
        deficit: round(section.deficit, 4),
        actionable: section.windows.length > 0 && section.deficit >= 0.3,
      })),
    })),
  });
}

function harmonyAt(song, beat) {
  return (song?.harmony ?? []).find((chord) => {
    const start = finite(chord?.start);
    const end = start + Math.max(0.05, finite(chord?.duration, 0.25));
    return beat >= start - 1e-6 && beat < end - 1e-6;
  }) ?? null;
}

function registerCenter(song, trackId, section) {
  const trackObject = track(song, trackId);
  const local = attacksInSection(trackObject, section).map((note) => finite(note?.pitch)).filter((pitch) => pitch > 0);
  const global = (trackObject?.notes ?? []).map((note) => finite(note?.pitch)).filter((pitch) => pitch > 0);
  const fallback = trackId === "pad" ? 52 : trackId === "chords" ? 58 : 67;
  return median(local, median(global, fallback));
}

function rootPitchNear(chord, center, min, max) {
  const rootPc = Number(chord?.rootPc);
  if (!Number.isFinite(rootPc)) return clamp(Math.round(center), min, max);
  const pc = ((Math.round(rootPc) % 12) + 12) % 12;
  let best = clamp(pc + 48, min, max);
  let distance = Number.POSITIVE_INFINITY;
  for (let pitch = pc; pitch <= 127; pitch += 12) {
    if (pitch < min || pitch > max) continue;
    const nextDistance = Math.abs(pitch - center);
    if (nextDistance < distance) {
      best = pitch;
      distance = nextDistance;
    }
  }
  return best;
}

function conductorPulses(song, metric, window) {
  const lane = metric.trackId === "drums" ? "anchors"
    : metric.trackId === "chords" ? "chordPulses"
      : metric.trackId === "counterpoint" ? "counterPulses"
        : null;
  if (!lane) return [];
  const pulses = [];
  const firstBar = Math.max(0, Math.floor(window.start / metric.beatsPerBar));
  const lastBar = Math.max(firstBar, Math.floor(Math.max(window.start, window.end - 0.001) / metric.beatsPerBar));
  for (let bar = firstBar; bar <= lastBar; bar += 1) {
    const plan = song?.grooveConductor?.bars?.[bar];
    for (const offset of plan?.[lane] ?? []) {
      const beat = bar * metric.beatsPerBar + finite(offset);
      if (beat >= window.start + 0.04 && beat < window.end - 0.06) pulses.push(beat);
    }
  }
  return pulses;
}

function chooseBeat(song, metric, window) {
  const midpoint = (window.start + window.end) / 2;
  const pulses = conductorPulses(song, metric, window);
  if (pulses.length) {
    return round([...pulses].sort((left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint) || left - right)[0], 4);
  }
  const harmonicStarts = (song?.harmony ?? [])
    .map((chord) => finite(chord?.start))
    .filter((beat) => beat >= window.start + 0.04 && beat < window.end - 0.06);
  if (harmonicStarts.length) {
    return round([...harmonicStarts].sort((left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint) || left - right)[0], 4);
  }
  return round(clamp(Math.round(midpoint * 4) / 4, window.start + 0.04, window.end - 0.06), 4);
}

function sourceVelocity(song, metric, start, fallback) {
  const notes = (track(song, metric.trackId)?.notes ?? [])
    .filter((note) => Number.isFinite(Number(note?.start)))
    .sort((left, right) => Math.abs(finite(left.start) - start) - Math.abs(finite(right.start) - start));
  return finite(notes[0]?.velocity, fallback);
}

function repairNote(song, metric, window, ordinal) {
  const start = chooseBeat(song, metric, window);
  const chord = harmonyAt(song, start);
  const center = registerCenter(song, metric.trackId, metric);
  const base = {
    start,
    sectionId: metric.id,
    continuityRole: `${metric.trackId}-continuity-link`,
  };
  if (metric.trackId === "drums") {
    return {
      ...base,
      id: `drum-continuity-${metric.id}-${ordinal}`,
      pitch: 36,
      duration: 0.08,
      velocity: Math.max(1, Math.min(127, Math.round(sourceVelocity(song, metric, start, 92) * 0.9))),
    };
  }
  const range = metric.trackId === "counterpoint" ? [55, 84]
    : metric.trackId === "chords" ? [45, 72]
      : [40, 68];
  const pitch = rootPitchNear(chord, center, range[0], range[1]);
  const chordEnd = chord ? finite(chord.start) + Math.max(0.25, finite(chord.duration, 1)) : window.end;
  const available = Math.max(0.12, Math.min(window.end, chordEnd) - start);
  const maxDuration = metric.trackId === "pad" ? 2.5 : metric.trackId === "chords" ? 1.5 : 0.65;
  const duration = round(clamp(available * (metric.trackId === "pad" ? 0.9 : 0.72), 0.12, maxDuration), 4);
  return {
    ...base,
    id: `${metric.trackId}-continuity-${metric.id}-${ordinal}`,
    pitch,
    duration,
    velocity: Math.max(1, Math.min(127, Math.round(sourceVelocity(
      song,
      metric,
      start,
      metric.trackId === "pad" ? 72 : metric.trackId === "chords" ? 80 : 82,
    ) * 0.88))),
  };
}

function opportunities(song) {
  return ENSEMBLE_CONTINUITY_TRACKS
    .flatMap((trackId) => analyzeTrack(song, trackId).actionable)
    .sort((left, right) => right.deficit - left.deficit || left.index - right.index || left.trackId.localeCompare(right.trackId));
}

function addRepairs(song, requests) {
  const candidate = cloneValue(song);
  const grouped = new Map();
  requests.forEach((metric, index) => {
    const note = repairNote(candidate, metric, metric.windows[0], index);
    if (!grouped.has(metric.trackId)) grouped.set(metric.trackId, []);
    grouped.get(metric.trackId).push(note);
  });
  for (const [trackId, notes] of grouped) {
    const trackObject = track(candidate, trackId);
    if (!trackObject) continue;
    trackObject.notes = [...(trackObject.notes ?? []), ...notes]
      .sort((left, right) => finite(left?.start) - finite(right?.start) || finite(left?.pitch) - finite(right?.pitch));
  }
  return candidate;
}

function candidateRequestSets(song, analysis = analyzeEnsembleContinuity(song)) {
  const all = opportunities(song);
  if (!all.length) return [];
  const weakest = all[0];
  const byTrack = [];
  const seen = new Set();
  for (const metric of all) {
    if (seen.has(metric.trackId)) continue;
    seen.add(metric.trackId);
    byTrack.push(metric);
    if (byTrack.length >= ENSEMBLE_CONTINUITY_TRACKS.length) break;
  }
  const bars = Math.max(1, finite(song?.meta?.bars, song?.bars ?? 1));
  const deepRequests = all.slice(0, MAX_DEEP_ENSEMBLE_LINKS);
  const deepEligible = bars >= LONG_SONG_ENSEMBLE_BARS
    && analysis.deficit >= SEVERE_ENSEMBLE_DEFICIT
    && deepRequests.length > byTrack.length;
  return [
    { id: "focused-ensemble-link", requests: [weakest] },
    ...(byTrack.length > 1 ? [{ id: "balanced-ensemble-links", requests: byTrack }] : []),
    ...(deepEligible ? [{ id: "deep-ensemble-links", requests: deepRequests }] : []),
  ];
}

export function createEnsembleContinuityCandidates(song, {
  maxCandidates = MAX_ENSEMBLE_CONTINUITY_CANDIDATES,
} = {}) {
  const before = analyzeEnsembleContinuity(song);
  if (before.deficit <= 0) return [];
  const seen = new Set();
  return candidateRequestSets(song, before)
    .slice(0, Math.max(0, Math.min(MAX_ENSEMBLE_CONTINUITY_CANDIDATES, Math.floor(maxCandidates))))
    .map((entry, candidateIndex) => {
      const candidateSong = addRepairs(song, entry.requests);
      const after = analyzeEnsembleContinuity(candidateSong);
      const signature = JSON.stringify(ENSEMBLE_CONTINUITY_TRACKS.map((trackId) => (
        track(candidateSong, trackId)?.notes?.map((note) => [finite(note.start), finite(note.pitch), finite(note.duration)]) ?? []
      )));
      if (seen.has(signature)) return null;
      seen.add(signature);
      const continuityErrorDelta = round(after.deficit - before.deficit, 4);
      return {
        id: entry.id,
        candidateIndex,
        song: candidateSong,
        changedNotes: entry.requests.length,
        beforeContinuityDeficit: before.deficit,
        afterContinuityDeficit: after.deficit,
        continuityErrorDelta,
        weakestTrackId: before.weakestTrackId,
        weakestSectionId: before.weakestSectionId,
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.changedNotes > 0 && candidate.continuityErrorDelta < -1e-6);
}
