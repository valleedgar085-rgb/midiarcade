import { cloneValue } from "./clone-value.js";
import { createJazzGrammarDirective } from "./jazz-musical-grammar.js";
import { judgeCompositionCandidate } from "./composition-candidate-judge.js";
import { generateSimilar } from "../music-engine.js";

const EPSILON = 1e-7;

function startOf(note) {
  return Number(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time ?? 0);
}

function durationOf(note) {
  return Math.max(0, Number(note?.duration ?? note?.length ?? note?.durationBeats ?? 0));
}

function endOf(note) {
  return startOf(note) + durationOf(note);
}

function tracksOf(song) {
  return Array.isArray(song?.tracks) ? song.tracks : [];
}

function trackId(track) {
  return String(track?.id ?? track?.role ?? track?.name ?? "");
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function trackShell(track) {
  if (!track || typeof track !== "object") return track;
  const { notes: _notes, ...shell } = track;
  return shell;
}

function sectionRange(song, sectionId) {
  const sections = song?.structure ?? song?.sections;
  if (!Array.isArray(sections)) return null;
  const section = sections.find((candidate) => String(candidate?.id) === String(sectionId));
  if (!section) return null;
  const beatsPerBar = Math.max(1, Number(song?.meta?.beatsPerBar ?? 4));
  const start = Number.isFinite(Number(section?.startBeat))
    ? Number(section.startBeat)
    : Number(section?.startBar ?? section?.start ?? 0) * beatsPerBar;
  const end = Number.isFinite(Number(section?.endBeat))
    ? Number(section.endBeat)
    : start + Math.max(1, Number(section?.bars ?? 1)) * beatsPerBar;
  return { section, start, end };
}

function fullyInside(note, range) {
  const start = startOf(note);
  const end = endOf(note);
  return start >= range.start - EPSILON && end <= range.end + EPSILON;
}

function noteSort(left, right) {
  return startOf(left) - startOf(right)
    || Number(left?.pitch ?? left?.note ?? 0) - Number(right?.pitch ?? right?.note ?? 0);
}

function replaceSectionNotes(sourceTrack, candidateTrack, range) {
  const sourceNotes = Array.isArray(sourceTrack?.notes) ? sourceTrack.notes : [];
  const candidateNotes = Array.isArray(candidateTrack?.notes) ? candidateTrack.notes : [];
  const preserved = sourceNotes.filter((note) => !fullyInside(note, range)).map(cloneValue);
  const replacement = candidateNotes.filter((note) => fullyInside(note, range)).map(cloneValue);
  return [...preserved, ...replacement].sort(noteSort);
}

function notesOutsideRange(track, range) {
  return (track?.notes ?? []).filter((note) => !fullyInside(note, range));
}

function selectionTarget(selection = {}) {
  const raw = String(selection?.target ?? selection?.scope ?? selection?.type ?? "song")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
  if (["song", "whole-song", "whole", "all"].includes(raw)) return "song";
  if (["track", "instrument", "whole-track", "whole-instrument"].includes(raw)) return "track";
  if (["section", "whole-section"].includes(raw)) return "section";
  if (["section-track", "sectiontrack", "section-instrument", "sectioninstrument", "instrument-section"].includes(raw)) {
    return "section-track";
  }
  return raw;
}

export function normalizeCompositionSelection(selection = {}, song = null) {
  const requested = selectionTarget(selection);
  const sectionId = selection?.sectionId ?? selection?.section ?? null;
  const requestedTrackId = selection?.trackId ?? selection?.instrumentId ?? selection?.instrument ?? null;
  const resolvedTrackId = requestedTrackId == null ? null : String(requestedTrackId);
  let target = requested;

  if (target === "track" && sectionId != null) target = "section-track";
  if (target === "section" && resolvedTrackId) target = "section-track";

  if (!["song", "track", "section", "section-track"].includes(target)) {
    throw new TypeError(`Unsupported composition selection target: ${requested}`);
  }
  if (["track", "section-track"].includes(target) && !resolvedTrackId) {
    throw new TypeError(`${target} selection requires trackId`);
  }
  if (["section", "section-track"].includes(target) && sectionId == null) {
    throw new TypeError(`${target} selection requires sectionId`);
  }

  if (song && resolvedTrackId && !tracksOf(song).some((track) => trackId(track) === resolvedTrackId)) {
    throw new RangeError(`Unknown track: ${resolvedTrackId}`);
  }
  if (song && sectionId != null && !sectionRange(song, sectionId)) {
    throw new RangeError(`Unknown section: ${sectionId}`);
  }

  return {
    target,
    ...(resolvedTrackId ? { trackId: resolvedTrackId } : {}),
    ...(sectionId != null ? { sectionId: String(sectionId) } : {}),
  };
}

export function createDirectorDirective(song, selection = {}) {
  if (!song || typeof song !== "object") throw new TypeError("createDirectorDirective requires a source song");
  const normalized = normalizeCompositionSelection(selection, song);
  const songPlan = song.songPlan ?? song.songBlueprint ?? null;
  const sectionPlan = normalized.sectionId == null
    ? null
    : (songPlan?.sections ?? songPlan?.sectionPlans ?? []).find(
      (plan) => String(plan?.sectionId ?? plan?.id) === normalized.sectionId,
    ) ?? null;
  const orchestration = normalized.sectionId == null
    ? null
    : (songPlan?.orchestrationMatrix ?? []).find(
      (entry) => String(entry?.sectionId) === normalized.sectionId,
    ) ?? null;
  const jazzGrammar = createJazzGrammarDirective(song, normalized);
  const interlock = normalized.sectionId == null
    ? null
    : (song?.generationInterlock?.sectionContracts ?? []).find(
      (entry) => String(entry?.sectionId) === normalized.sectionId,
    ) ?? null;

  return Object.freeze({
    version: 1,
    selection: Object.freeze({ ...normalized }),
    songPlan: cloneValue(songPlan),
    sectionPlan: cloneValue(sectionPlan),
    orchestration: cloneValue(orchestration),
    interlock: cloneValue(interlock),
    harmony: cloneValue(song?.harmony ?? []),
    jazzGrammar: cloneValue(jazzGrammar),
    sourceSongId: song?.id ?? null,
    sourceSeed: song?.seed ?? null,
  });
}

function candidateInput(sourceSong, directive, input) {
  const normalized = directive.selection;
  const archetype = directive?.jazzGrammar?.archetype ?? null;
  const jazzDefaults = archetype
    ? {
      ...(input?.syncopation == null ? { syncopation: archetype.syncopation } : {}),
      ...(input?.humanize == null ? { humanize: archetype.humanize } : {}),
      ...(input?.compositionRoute == null
        ? {
          compositionRoute: ["bebop", "cool", "modal", "ballad"].includes(archetype.id)
            ? "harmony-first"
            : "groove-first",
        }
        : {}),
    }
    : {};
  return {
    ...input,
    ...jazzDefaults,
    jazzGrammar: directive?.jazzGrammar ?? null,
    directorDirective: directive,
    ...(normalized.target === "track" || normalized.target === "section-track"
      ? { targetTrack: normalized.trackId }
      : {}),
  };
}

function applyScopedCandidate(sourceSong, generatedSong, selection) {
  if (selection.target === "song") return cloneValue(generatedSong);

  const after = cloneValue(sourceSong);
  const generatedTracks = new Map(tracksOf(generatedSong).map((track) => [trackId(track), track]));

  if (selection.target === "track") {
    const sourceTrack = tracksOf(after).find((track) => trackId(track) === selection.trackId);
    const generatedTrack = generatedTracks.get(selection.trackId);
    if (!sourceTrack || !generatedTrack) throw new Error(`Composer did not return ${selection.trackId}`);
    sourceTrack.notes = cloneValue(generatedTrack.notes ?? []);
    return after;
  }

  const range = sectionRange(sourceSong, selection.sectionId);
  const targetIds = selection.target === "section-track"
    ? new Set([selection.trackId])
    : new Set(tracksOf(sourceSong).map(trackId));

  for (const sourceTrack of tracksOf(after)) {
    const id = trackId(sourceTrack);
    if (!targetIds.has(id)) continue;
    const generatedTrack = generatedTracks.get(id);
    if (!generatedTrack) throw new Error(`Composer did not return ${id}`);
    sourceTrack.notes = replaceSectionNotes(sourceTrack, generatedTrack, range);
  }
  return after;
}

function scopeChanged(before, after, selection) {
  if (selection.target === "song") return !deepEqual(before, after);
  const beforeTracks = new Map(tracksOf(before).map((track) => [trackId(track), track]));
  const afterTracks = new Map(tracksOf(after).map((track) => [trackId(track), track]));
  if (selection.target === "track") {
    return !deepEqual(beforeTracks.get(selection.trackId)?.notes, afterTracks.get(selection.trackId)?.notes);
  }
  const range = sectionRange(before, selection.sectionId);
  const ids = selection.target === "section-track"
    ? [selection.trackId]
    : [...beforeTracks.keys()];
  return ids.some((id) => {
    const left = (beforeTracks.get(id)?.notes ?? []).filter((note) => fullyInside(note, range));
    const right = (afterTracks.get(id)?.notes ?? []).filter((note) => fullyInside(note, range));
    return !deepEqual(left, right);
  });
}

function validateScopeIntegrity(before, after, selection, issues) {
  if (selection.target === "song") return;

  for (const authority of ["structure", "sections", "harmony", "songBlueprint", "songPlan"]) {
    if (before?.[authority] !== undefined && !deepEqual(before[authority], after?.[authority])) {
      issues.push(`authority-changed:${authority}`);
    }
  }

  const beforeTracks = new Map(tracksOf(before).map((track) => [trackId(track), track]));
  const afterTracks = new Map(tracksOf(after).map((track) => [trackId(track), track]));
  const targetIds = selection.target === "section"
    ? new Set(beforeTracks.keys())
    : new Set([selection.trackId]);
  const range = selection.sectionId == null ? null : sectionRange(before, selection.sectionId);

  for (const [id, sourceTrack] of beforeTracks) {
    const candidateTrack = afterTracks.get(id);
    if (!candidateTrack) {
      issues.push(`track-missing:${id}`);
      continue;
    }
    if (!targetIds.has(id)) {
      if (!deepEqual(sourceTrack, candidateTrack)) issues.push(`scope-escape:${id}`);
      continue;
    }
    if (!deepEqual(trackShell(sourceTrack), trackShell(candidateTrack))) {
      issues.push(`track-metadata-changed:${id}`);
    }
    if (range && !deepEqual(notesOutsideRange(sourceTrack, range), notesOutsideRange(candidateTrack, range))) {
      issues.push(`boundary-or-outside-changed:${id}`);
    }
  }
}

function validateScaleSafety(after, selection, issues) {
  const keyPc = Number(after?.meta?.keyPc);
  const intervals = after?.meta?.scaleIntervals;
  if (!Number.isFinite(keyPc) || !Array.isArray(intervals) || !intervals.length) return;

  const allowed = new Set(intervals.map((interval) => ((keyPc + Number(interval)) % 12 + 12) % 12));
  const range = selection.sectionId == null ? null : sectionRange(after, selection.sectionId);
  const targetIds = selection.target === "song" || selection.target === "section"
    ? new Set(tracksOf(after).map(trackId))
    : new Set([selection.trackId]);

  for (const track of tracksOf(after)) {
    const id = trackId(track);
    if (!targetIds.has(id) || id === "drums") continue;
    for (const note of track.notes ?? []) {
      if (range && !fullyInside(note, range)) continue;
      const pitch = Number(note?.pitch ?? note?.note ?? note?.midi);
      if (!Number.isFinite(pitch)) continue;
      if (!allowed.has(((Math.round(pitch) % 12) + 12) % 12)) {
        issues.push(`out-of-scale:${id}:${Math.round(pitch)}`);
      }
    }
  }
}

export function validateCompositionCandidate(transaction) {
  const issues = [];
  if (!transaction || transaction.status !== "candidate") {
    return { valid: false, issues: ["invalid-transaction"], judge: null };
  }
  validateScopeIntegrity(transaction.before, transaction.after, transaction.selection, issues);
  validateScaleSafety(transaction.after, transaction.selection, issues);
  const judge = judgeCompositionCandidate(
    transaction.before,
    transaction.after,
    transaction.selection,
    transaction.directive,
  );
  issues.push(...judge.hardIssues);
  const uniqueIssues = [...new Set(issues)];
  return {
    valid: uniqueIssues.length === 0,
    issues: uniqueIssues,
    judge,
  };
}

export function createCompositionCandidate(
  sourceSong,
  selection = {},
  input = {},
  { composer = generateSimilar } = {},
) {
  if (!sourceSong || !Array.isArray(sourceSong.tracks)) {
    throw new TypeError("createCompositionCandidate requires a generated source song");
  }
  if (typeof composer !== "function") throw new TypeError("composer must be a function");

  const directive = createDirectorDirective(sourceSong, selection);
  const generated = composer(sourceSong, candidateInput(sourceSong, directive, input));
  if (!generated || !Array.isArray(generated.tracks)) {
    throw new Error("Composer returned an invalid song candidate");
  }

  const after = applyScopedCandidate(sourceSong, generated, directive.selection);
  const transaction = {
    version: 1,
    status: "candidate",
    selection: directive.selection,
    directive,
    before: cloneValue(sourceSong),
    after,
    generated: cloneValue(generated),
    summary: {
      changed: scopeChanged(sourceSong, after, directive.selection),
      sourceSongId: sourceSong?.id ?? null,
      generatedSongId: generated?.id ?? null,
    },
  };
  transaction.validation = validateCompositionCandidate(transaction);
  return transaction;
}

export function acceptCompositionCandidate(transaction) {
  const validation = validateCompositionCandidate(transaction);
  if (!validation.valid) {
    throw new Error(`Cannot accept invalid composition candidate: ${validation.issues.join(", ")}`);
  }
  return cloneValue(transaction.after);
}

export function rejectCompositionCandidate(transaction) {
  if (!transaction?.before) throw new TypeError("rejectCompositionCandidate requires a candidate transaction");
  return cloneValue(transaction.before);
}
