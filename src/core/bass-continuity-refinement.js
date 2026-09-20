import { cloneValue } from "./clone-value.js";

export const MAX_BASS_CONTINUITY_CANDIDATES = 2;

const EXCLUDED_SECTION_NAMES = ["intro", "outro", "breakdown", "interlude"];
const BASS_FORWARD_GENRES = new Set([
  "hipHop", "rap", "trap", "house", "techno", "drumBass", "drill",
  "reggaeton", "afrobeats", "funk", "popRadio", "synthPopRadio",
]);
const SOULFUL_GENRES = new Set(["neoSoul", "rnbSoul", "loFiHipHop", "jazz"]);

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

function normalizeName(section) {
  return String(section?.name ?? section?.type ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeGenre(song) {
  return String(song?.genre ?? song?.meta?.genre ?? "pop").trim();
}

function isExcludedSectionName(name) {
  return EXCLUDED_SECTION_NAMES.some((excluded) => name === excluded || name.startsWith(excluded));
}

function sectionBounds(song, section) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const bars = Math.max(1, finite(
    section?.bars,
    (finite(section?.endBeat, startBeat + beatsPerBar) - startBeat) / beatsPerBar,
  ));
  const endBeat = Math.max(startBeat + 0.25, finite(section?.endBeat, startBeat + bars * beatsPerBar));
  return { startBeat, endBeat, bars, beatsPerBar };
}

function sectionExpectsBass(song, sectionId) {
  const scene = song?.producerIntent?.scenes?.find((entry) => entry?.sectionId === sectionId);
  if (scene?.roles?.bass === "rest") return false;
  const lane = song?.orchestrationMatrix
    ?.find((entry) => entry?.sectionId === sectionId)
    ?.lanes?.bass;
  return finite(lane?.presence, 1) >= 0.42;
}

function bassSections(song) {
  const structure = Array.isArray(song?.structure) ? song.structure : song?.sections;
  if (!Array.isArray(structure)) return [];
  return structure.map((section, index) => {
    const name = normalizeName(section);
    const id = String(section?.id ?? `${name || "section"}-${index + 1}`);
    return {
      section,
      index,
      id,
      name,
      expected: sectionExpectsBass(song, id),
      ...sectionBounds(song, section),
    };
  }).filter(({ name, expected }) => name && expected && !isExcludedSectionName(name));
}

function track(song, id) {
  return (song?.tracks ?? []).find((entry) => entry?.id === id) ?? null;
}

function bassAttacksInSection(bass, bounds) {
  return (bass?.notes ?? [])
    .filter((note) => finite(note?.start) >= bounds.startBeat - 1e-6 && finite(note?.start) < bounds.endBeat - 1e-6)
    .sort((left, right) => finite(left?.start) - finite(right?.start) || finite(left?.pitch) - finite(right?.pitch));
}

function bassOverlapsSection(bass, bounds) {
  return (bass?.notes ?? [])
    .filter((note) => {
      const start = finite(note?.start);
      const end = start + Math.max(0.08, finite(note?.duration, 0.25));
      return start < bounds.endBeat - 1e-6 && end > bounds.startBeat + 1e-6;
    })
    .sort((left, right) => finite(left?.start) - finite(right?.start) || finite(left?.pitch) - finite(right?.pitch));
}

function median(values, fallback = 0) {
  const clean = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!clean.length) return fallback;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function sectionRateMultiplier(name) {
  if (name.includes("chorus") || name.includes("drop") || name.includes("theme")) return 0.82;
  if (name.includes("prechorus") || name.includes("build")) return 0.72;
  if (name.includes("verse") || name.includes("idea") || name.includes("solo")) return 0.66;
  if (name.includes("bridge")) return 0.52;
  return 0.62;
}

function genreFloor(genre) {
  if (genre === "ambient") return 0.28;
  if (SOULFUL_GENRES.has(genre)) return 0.72;
  if (BASS_FORWARD_GENRES.has(genre)) return 1;
  return 0.78;
}

function maxSilenceTarget(genre, name, beatsPerBar) {
  const baseBars = genre === "ambient" ? 2
    : SOULFUL_GENRES.has(genre) ? 1.45
      : BASS_FORWARD_GENRES.has(genre) ? 1.05
        : 1.25;
  const sectionLift = name.includes("bridge") ? 0.6
    : name.includes("verse") ? 0.25
      : name.includes("prechorus") || name.includes("build") ? 0.12
        : 0;
  return Math.max(beatsPerBar * 0.75, beatsPerBar * (baseBars + sectionLift));
}

function silenceWindows(notes, bounds) {
  const windows = [];
  let cursor = bounds.startBeat;
  for (const note of notes) {
    const start = clamp(finite(note?.start), bounds.startBeat, bounds.endBeat);
    if (start - cursor >= 0.65) windows.push({ start: cursor, end: start, gap: start - cursor });
    const noteEnd = finite(note?.start) + Math.max(0.08, finite(note?.duration, 0.25));
    cursor = Math.max(cursor, Math.min(bounds.endBeat, noteEnd));
  }
  if (bounds.endBeat - cursor >= 0.65) {
    windows.push({ start: cursor, end: bounds.endBeat, gap: bounds.endBeat - cursor });
  }
  return windows.sort((left, right) => right.gap - left.gap || left.start - right.start);
}

function rawSectionMetrics(song, bass, bounds) {
  const attacks = bassAttacksInSection(bass, bounds);
  const overlaps = bassOverlapsSection(bass, bounds);
  return {
    ...bounds,
    attacks,
    overlaps,
    attacksPerBar: attacks.length / Math.max(1, bounds.bars),
    windows: silenceWindows(overlaps, bounds),
  };
}

function sectionContinuity(song, metric, baselineRate) {
  const genre = normalizeGenre(song);
  const targetAttacksPerBar = Math.max(
    genreFloor(genre),
    Math.min(2.5, baselineRate * sectionRateMultiplier(metric.name)),
  );
  const targetMaxSilenceBeats = maxSilenceTarget(genre, metric.name, metric.beatsPerBar);
  const maxSilenceBeats = metric.windows[0]?.gap ?? 0;
  const attackDeficit = Math.max(0, targetAttacksPerBar - metric.attacksPerBar);
  const silenceDeficit = Math.max(0, maxSilenceBeats - targetMaxSilenceBeats) / Math.max(1, metric.beatsPerBar);
  const missingPenalty = metric.attacks.length === 0 ? 0.8 : 0;
  return {
    ...metric,
    targetAttacksPerBar,
    targetMaxSilenceBeats,
    maxSilenceBeats,
    deficit: attackDeficit + silenceDeficit + missingPenalty,
  };
}

export function analyzeBassContinuity(song) {
  const bass = track(song, "bass");
  if (!bass) return Object.freeze({ deficit: 0, baselineAttacksPerBar: 0, weakestSectionId: null, sections: [] });
  const raw = bassSections(song).map((bounds) => rawSectionMetrics(song, bass, bounds));
  const populatedRates = raw.filter(({ attacks }) => attacks.length > 0).map(({ attacksPerBar }) => attacksPerBar);
  const baselineAttacksPerBar = median(populatedRates, genreFloor(normalizeGenre(song)));
  const sections = raw.map((metric) => sectionContinuity(song, metric, baselineAttacksPerBar));
  const actionable = sections
    .filter(({ windows, deficit }) => windows.length > 0 && deficit >= 0.22)
    .sort((left, right) => right.deficit - left.deficit || right.maxSilenceBeats - left.maxSilenceBeats || left.index - right.index);
  return Object.freeze({
    deficit: round(actionable.reduce((sum, section) => sum + section.deficit, 0), 4),
    baselineAttacksPerBar: round(baselineAttacksPerBar, 3),
    weakestSectionId: actionable[0]?.id ?? null,
    sections: sections.map((section) => Object.freeze({
      id: section.id,
      name: section.name,
      attacksPerBar: round(section.attacksPerBar, 3),
      maxSilenceBeats: round(section.maxSilenceBeats, 3),
      targetAttacksPerBar: round(section.targetAttacksPerBar, 3),
      targetMaxSilenceBeats: round(section.targetMaxSilenceBeats, 3),
      deficit: round(section.deficit, 4),
      actionable: section.windows.length > 0 && section.deficit >= 0.22,
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

function bassRegisterCenter(song, section) {
  const bass = track(song, "bass");
  const local = bassAttacksInSection(bass, section).map((note) => finite(note?.pitch)).filter((pitch) => pitch > 0);
  const global = (bass?.notes ?? []).map((note) => finite(note?.pitch)).filter((pitch) => pitch > 0);
  return clamp(median(local, median(global, 40)), 28, 55);
}

function chordRootNear(chord, center, fallbackPitch) {
  const rootPc = Number(chord?.rootPc);
  if (!Number.isFinite(rootPc)) return clamp(Math.round(fallbackPitch), 24, 60);
  const pc = ((Math.round(rootPc) % 12) + 12) % 12;
  let best = pc + 24;
  let distance = Number.POSITIVE_INFINITY;
  for (let pitch = pc + 12; pitch <= 72; pitch += 12) {
    if (pitch < 24 || pitch > 60) continue;
    const nextDistance = Math.abs(pitch - center);
    if (nextDistance < distance) {
      best = pitch;
      distance = nextDistance;
    }
  }
  return best;
}

function kickOnsets(song, window) {
  return (track(song, "drums")?.notes ?? [])
    .filter((note) => finite(note?.pitch) === 36)
    .map((note) => finite(note?.start))
    .filter((start) => start >= window.start + 0.05 && start < window.end - 0.08);
}

function chooseInsertionBeat(song, window) {
  const midpoint = (window.start + window.end) / 2;
  const kicks = kickOnsets(song, window);
  if (kicks.length) {
    return round([...kicks].sort((left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint) || left - right)[0], 4);
  }
  const harmonicStarts = (song?.harmony ?? [])
    .map((chord) => finite(chord?.start))
    .filter((start) => start >= window.start + 0.05 && start < window.end - 0.08);
  if (harmonicStarts.length) {
    return round([...harmonicStarts].sort((left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint) || left - right)[0], 4);
  }
  return round(clamp(Math.round(midpoint * 4) / 4, window.start + 0.05, window.end - 0.08), 4);
}

function connectorRequest(song, section, window, ordinal) {
  const bass = track(song, "bass");
  const start = chooseInsertionBeat(song, window);
  const chord = harmonyAt(song, start);
  const allNotes = (bass?.notes ?? []).sort((left, right) => finite(left?.start) - finite(right?.start));
  const previous = [...allNotes].reverse().find((note) => finite(note?.start) < start - 0.05);
  const next = allNotes.find((note) => finite(note?.start) > start + 0.05);
  const source = previous ?? next ?? { pitch: 40, velocity: 84 };
  const pitch = chordRootNear(chord, bassRegisterCenter(song, section), finite(source?.pitch, 40));
  const chordEnd = chord ? finite(chord?.start) + Math.max(0.25, finite(chord?.duration, 1)) : window.end;
  const nextStart = next ? finite(next?.start) : window.end;
  const available = Math.max(0.18, Math.min(window.end, chordEnd, nextStart) - start);
  return {
    id: `${String(source?.id ?? "bass-link")}:continuity-${section.id}-${ordinal}`,
    pitch,
    start,
    duration: round(clamp(available * 0.72, 0.18, 1), 4),
    velocity: Math.max(1, Math.min(127, Math.round(finite(source?.velocity, 84) * 0.9))),
    sectionId: section.id,
    continuityRole: "bass-foundation-link",
  };
}

function opportunities(song) {
  const bass = track(song, "bass");
  if (!bass) return [];
  const raw = bassSections(song).map((bounds) => rawSectionMetrics(song, bass, bounds));
  const populatedRates = raw.filter(({ attacks }) => attacks.length > 0).map(({ attacksPerBar }) => attacksPerBar);
  const baseline = median(populatedRates, genreFloor(normalizeGenre(song)));
  return raw
    .map((metric) => sectionContinuity(song, metric, baseline))
    .filter(({ windows, deficit }) => windows.length > 0 && deficit >= 0.22)
    .sort((left, right) => right.deficit - left.deficit || right.maxSilenceBeats - left.maxSilenceBeats || left.index - right.index);
}

function addConnectors(song, requests) {
  const candidate = cloneValue(song);
  const bass = track(candidate, "bass");
  if (!bass) return candidate;
  const additions = requests.map(({ section, window }, index) => connectorRequest(candidate, section, window, index));
  bass.notes = [...(bass.notes ?? []), ...additions]
    .sort((left, right) => finite(left?.start) - finite(right?.start) || finite(left?.pitch) - finite(right?.pitch));
  return candidate;
}

function candidateRequestSets(song) {
  const sections = opportunities(song);
  if (!sections.length) return [];
  const weakest = sections[0];
  const balanced = sections.slice(0, 3).map((section) => ({ section, window: section.windows[0] }));
  return [
    { id: "focused-foundation-anchor", requests: [{ section: weakest, window: weakest.windows[0] }] },
    ...(balanced.length > 1 ? [{ id: "balanced-foundation-links", requests: balanced.slice(0, 3) }] : []),
  ];
}

export function createBassContinuityCandidates(song, {
  maxCandidates = MAX_BASS_CONTINUITY_CANDIDATES,
} = {}) {
  const before = analyzeBassContinuity(song);
  if (before.deficit <= 0) return [];
  const seen = new Set();
  return candidateRequestSets(song)
    .slice(0, Math.max(0, Math.min(MAX_BASS_CONTINUITY_CANDIDATES, Math.floor(maxCandidates))))
    .map((entry, candidateIndex) => {
      const candidateSong = addConnectors(song, entry.requests);
      const after = analyzeBassContinuity(candidateSong);
      const signature = JSON.stringify(
        track(candidateSong, "bass")?.notes?.map((note) => [finite(note.start), finite(note.pitch), finite(note.duration)]) ?? [],
      );
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
        weakestSectionId: before.weakestSectionId,
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.changedNotes > 0 && candidate.continuityErrorDelta < -1e-6);
}
