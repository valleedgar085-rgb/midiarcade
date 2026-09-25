import { cloneValue } from "./clone-value.js";
import { trackGroovePulses } from "./groove-contract.js";

export const MAX_MELODY_CONTINUITY_CANDIDATES = 3;
export const MAX_MELODY_CONTINUITY_LINKS = 28;

const EXCLUDED_SECTION_NAMES = ["intro", "outro", "breakdown", "interlude"];

function isExcludedSectionName(name) {
  return EXCLUDED_SECTION_NAMES.some((excluded) => name === excluded || name.startsWith(excluded));
}

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

function continuityTargets(sectionName) {
  if (sectionName.includes("chorus") || sectionName.includes("drop")) {
    return { attacksPerBar: 2.1, maxSilenceBeats: 2.25 };
  }
  if (sectionName.includes("prechorus") || sectionName.includes("build")) {
    return { attacksPerBar: 1.85, maxSilenceBeats: 2.5 };
  }
  if (sectionName.includes("verse")) {
    return { attacksPerBar: 1.6, maxSilenceBeats: 2.75 };
  }
  if (sectionName.includes("bridge")) {
    return { attacksPerBar: 1.35, maxSilenceBeats: 3 };
  }
  return { attacksPerBar: 1.4, maxSilenceBeats: 3 };
}

function melodicSections(song) {
  const structure = Array.isArray(song?.structure) ? song.structure : song?.sections;
  if (!Array.isArray(structure)) return [];
  return structure.map((section, index) => {
    const name = normalizeName(section);
    return {
      section,
      index,
      id: String(section?.id ?? `${name || "section"}-${index + 1}`),
      name,
      ...sectionBounds(song, section),
    };
  }).filter(({ name }) => name && !isExcludedSectionName(name));
}

function melodyTrack(song) {
  return (song?.tracks ?? []).find((track) => track?.id === "melody") ?? null;
}

function notesInSection(track, bounds) {
  return (track?.notes ?? [])
    .filter((note) => finite(note?.start) >= bounds.startBeat - 1e-6 && finite(note?.start) < bounds.endBeat - 1e-6)
    .sort((left, right) => finite(left?.start) - finite(right?.start) || finite(left?.pitch) - finite(right?.pitch));
}

function silenceWindows(notes, bounds) {
  if (notes.length < 2) return [];
  const windows = [];
  for (let index = 0; index < notes.length - 1; index += 1) {
    const previous = notes[index];
    const next = notes[index + 1];
    const start = Math.max(
      bounds.startBeat + 0.25,
      finite(previous?.start) + Math.max(0.08, finite(previous?.duration, 0.25)) + 0.08,
    );
    const end = Math.min(bounds.endBeat - 0.5, finite(next?.start) - 0.08);
    const gap = end - start;
    if (gap >= 0.7) {
      windows.push({ start, end, gap, previous, next });
    }
  }
  return windows.sort((left, right) => right.gap - left.gap || left.start - right.start);
}

function sectionContinuity(song, track, bounds) {
  const notes = notesInSection(track, bounds);
  const targets = continuityTargets(bounds.name);
  const attacksPerBar = notes.length / Math.max(1, bounds.bars);
  const rawWindows = silenceWindows(notes, bounds);
  const structuralGroove = Boolean(
    song?.grooveConductor?.grooveDNA?.grammarId
    && song.grooveConductor.grooveDNA.grammarId !== "general-balanced-groove"
  );
  const windows = structuralGroove
    ? rawWindows.filter((window) => (
      trackGroovePulses(
        song?.grooveConductor,
        "melody",
        window.start,
        window.end - 0.12,
        bounds.beatsPerBar,
      ).length > 0
    ))
    : rawWindows;
  const maxSilenceBeats = windows[0]?.gap ?? 0;
  const attackDeficit = Math.max(0, targets.attacksPerBar - attacksPerBar);
  const silenceDeficit = Math.max(0, maxSilenceBeats - targets.maxSilenceBeats) / Math.max(1, bounds.beatsPerBar);
  return {
    ...bounds,
    notes,
    windows,
    attacksPerBar,
    maxSilenceBeats,
    targetAttacksPerBar: targets.attacksPerBar,
    targetMaxSilenceBeats: targets.maxSilenceBeats,
    silenceDeficit,
    deficit: attackDeficit + silenceDeficit,
  };
}

export function analyzeMelodyContinuity(song) {
  const track = melodyTrack(song);
  if (!track) return Object.freeze({ deficit: 0, weakestSectionId: null, sections: [] });
  const sections = melodicSections(song)
    .map((bounds) => sectionContinuity(song, track, bounds));
  const actionable = sections
    .filter(({ notes, windows, silenceDeficit }) => notes.length >= 2 && windows.length > 0 && silenceDeficit > 0.05)
    .sort((left, right) => right.deficit - left.deficit || right.maxSilenceBeats - left.maxSilenceBeats || left.index - right.index);
  return Object.freeze({
    deficit: round(actionable.reduce((sum, section) => sum + section.deficit, 0), 4),
    weakestSectionId: actionable[0]?.id ?? null,
    sections: sections.map((section) => Object.freeze({
      id: section.id,
      name: section.name,
      attacksPerBar: round(section.attacksPerBar, 3),
      maxSilenceBeats: round(section.maxSilenceBeats, 3),
      targetAttacksPerBar: section.targetAttacksPerBar,
      targetMaxSilenceBeats: section.targetMaxSilenceBeats,
      deficit: round(section.deficit, 4),
      actionable: section.notes.length >= 2 && section.windows.length > 0 && section.silenceDeficit > 0.05,
    })),
  });
}

function chooseInsertionBeat(song, window, slot = 0, slots = 1) {
  const ratio = slots > 1 ? (slot + 1) / (slots + 1) : 0.5;
  const midpoint = window.start + (window.end - window.start) * ratio;
  const groovePulses = trackGroovePulses(
    song?.grooveConductor,
    "melody",
    window.start,
    window.end - 0.12,
    Math.max(1, finite(song?.meta?.beatsPerBar, 4)),
  );
  if (groovePulses.length) {
    return round([...groovePulses].sort((left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint) || left - right)[0], 4);
  }
  const quantized = Math.round(midpoint * 4) / 4;
  return round(clamp(quantized, window.start, window.end - 0.12), 4);
}

function connectorNote(song, window, sectionId, mode, ordinal, slot = 0, slots = 1) {
  const source = mode === "anticipation" ? window.next : window.previous;
  const start = chooseInsertionBeat(song, window, slot, slots);
  const available = Math.max(0.12, window.end - start);
  const duration = round(clamp(Math.min(0.5, available * 0.72), 0.12, 0.5), 4);
  const velocity = Math.max(1, Math.min(127, Math.round(finite(source?.velocity, 84) * 0.84)));
  return {
    id: `${String(source?.id ?? "melody-link")}:continuity-${sectionId}-${ordinal}`,
    pitch: finite(source?.pitch, 60),
    start,
    duration,
    velocity,
    sectionId,
    continuityRole: "phrase-link",
  };
}

function addConnectors(song, requests) {
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  if (!track) return candidate;
  const additions = requests.map(({ window, sectionId, mode, slot = 0, slots = 1 }, index) => (
    connectorNote(candidate, window, sectionId, mode, index, slot, slots)
  ));
  track.notes = [...(track.notes ?? []), ...additions]
    .sort((left, right) => finite(left?.start) - finite(right?.start) || finite(left?.pitch) - finite(right?.pitch));
  return candidate;
}

function candidateRequestSets(song) {
  const track = melodyTrack(song);
  if (!track) return [];
  const opportunities = melodicSections(song)
    .map((bounds) => sectionContinuity(song, track, bounds))
    .filter(({ notes, windows, silenceDeficit }) => notes.length >= 2 && windows.length > 0 && silenceDeficit > 0.05)
    .sort((left, right) => right.deficit - left.deficit || right.maxSilenceBeats - left.maxSilenceBeats || left.index - right.index);
  if (!opportunities.length) return [];

  const weakest = opportunities[0];
  const balanced = [];
  let balancedSong = song;
  while (balanced.length < MAX_MELODY_CONTINUITY_LINKS) {
    const next = melodicSections(balancedSong)
      .map((bounds) => sectionContinuity(balancedSong, melodyTrack(balancedSong), bounds))
      .filter(({ notes, windows, silenceDeficit }) => (
        notes.length >= 2
        && windows.length > 0
        && silenceDeficit > 0.05
      ))
      .sort((left, right) => right.deficit - left.deficit || right.maxSilenceBeats - left.maxSilenceBeats || left.index - right.index)[0];
    const window = next?.windows?.[0];
    if (!next || !window) break;
    const request = { sectionId: next.id, window, mode: "echo" };
    balanced.push(request);
    balancedSong = addConnectors(balancedSong, [request]);
  }
  return [
    {
      id: "focused-echo",
      requests: [{ sectionId: weakest.id, window: weakest.windows[0], mode: "echo" }],
    },
    {
      id: "focused-anticipation",
      requests: [{ sectionId: weakest.id, window: weakest.windows[0], mode: "anticipation" }],
    },
    ...(balanced.length > 1 ? [{ id: "balanced-links", requests: balanced }] : []),
  ];
}

export function createMelodyContinuityCandidates(song, {
  maxCandidates = MAX_MELODY_CONTINUITY_CANDIDATES,
} = {}) {
  const before = analyzeMelodyContinuity(song);
  if (before.deficit <= 0) return [];
  const seen = new Set();
  return candidateRequestSets(song)
    .slice(0, Math.max(0, Math.min(MAX_MELODY_CONTINUITY_CANDIDATES, Math.floor(maxCandidates))))
    .map((entry, candidateIndex) => {
      const candidateSong = addConnectors(song, entry.requests);
      const after = analyzeMelodyContinuity(candidateSong);
      const signature = JSON.stringify(
        melodyTrack(candidateSong)?.notes?.map((note) => [finite(note.start), finite(note.pitch), finite(note.duration)]) ?? [],
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
