import { clamp, finite } from "../utils.js";
import { createShapeIntent } from "./shape-director-policy.js";
import { clampMidiVelocity, MIDI_NOTE_VELOCITY_MAX } from "./note-contract.js";
import { hash32 } from "./deterministic-rng.js";
import { cloneValue } from "./clone-value.js";

function eventStart(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time ?? note?.tick, 0);
}

function setEventStart(note, value) {
  const key = ["start", "startBeat", "beat", "time", "tick"].find((candidate) => (
    Object.prototype.hasOwnProperty.call(note, candidate)
  )) || "start";
  note[key] = value;
}

function eventDuration(note) {
  return Math.max(0.03125, finite(note?.duration ?? note?.length ?? note?.durationBeats, 0.5));
}

function setEventDuration(note, value) {
  const key = ["duration", "length", "durationBeats"].find((candidate) => (
    Object.prototype.hasOwnProperty.call(note, candidate)
  )) || "duration";
  note[key] = Math.max(0.03125, value);
}

function eventVelocity(note) {
  const raw = finite(note?.velocity ?? note?.vel, 90);
  return raw <= 1 ? Math.round(raw * 127) : raw;
}

function setEventVelocity(note, value) {
  const safe = clampMidiVelocity(value, 90);
  if (Object.prototype.hasOwnProperty.call(note, "vel") && finite(note.vel, 90) <= 1) {
    note.vel = safe / 127;
  } else {
    note.velocity = safe;
  }
}

function eventPitch(note) {
  return Math.round(clamp(finite(note?.pitch ?? note?.note ?? note?.midi, 60), 0, 127));
}

function setEventPitch(note, value) {
  const key = ["pitch", "note", "midi"].find((candidate) => (
    Object.prototype.hasOwnProperty.call(note, candidate)
  )) || "pitch";
  note[key] = Math.round(clamp(value, 0, 127));
}

function noteIdentity(note, index) {
  return String(note?.id ?? note?.noteId ?? note?.uid ?? `index:${index}`);
}

function sectionRange(song, sectionId) {
  const sections = song?.structure ?? song?.sections;
  if (!Array.isArray(sections)) return null;
  const section = sections.find((candidate) => String(candidate?.id) === String(sectionId));
  if (!section) return null;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = finite(section?.startBeat, finite(section?.startBar, finite(section?.start, 0)) * beatsPerBar);
  const bars = Math.max(1, Math.round(finite(section?.bars, 1)));
  const end = finite(section?.endBeat, start + bars * beatsPerBar);
  return { section, start, end, beatsPerBar };
}

function sourceTracks(song) {
  return Array.isArray(song?.tracks) ? song.tracks : [];
}

function targetedTrackIds(song, selection) {
  if (selection.target === "section") return sourceTracks(song).map((track) => String(track?.id));
  return [selection.trackId];
}

function collectEligible(candidate, selection) {
  const range = sectionRange(candidate, selection.sectionId);
  if (!range) return { error: "section-not-found", entries: [], range: null };
  const allowedNoteIds = selection.target === "notes" ? new Set(selection.noteIds) : null;
  const targetIds = new Set(targetedTrackIds(candidate, selection));
  const entries = [];

  for (const track of sourceTracks(candidate)) {
    const trackId = String(track?.id);
    if (!targetIds.has(trackId)) continue;
    if (!Array.isArray(track?.notes)) continue;
    track.notes.forEach((note, index) => {
      const start = eventStart(note);
      if (start < range.start - 1e-7 || start >= range.end - 1e-7) return;
      const id = noteIdentity(note, index);
      if (allowedNoteIds && !allowedNoteIds.has(id)) return;
      entries.push({ track, trackId, note, index, id });
    });
  }

  if (selection.target === "track" && !sourceTracks(candidate).some((track) => String(track?.id) === selection.trackId)) {
    return { error: "track-not-found", entries: [], range };
  }
  if (selection.target === "notes") {
    const found = new Set(entries.map((entry) => entry.id));
    const missing = selection.noteIds.filter((id) => !found.has(id));
    if (missing.length) return { error: "selected-notes-not-found", entries: [], range, missing };
  }
  if (!entries.length) return { error: "scope-has-no-notes", entries: [], range };
  return { error: null, entries, range };
}

function chooseRewriteEntries(entries, budget, seedKey) {
  const count = Math.max(1, Math.min(entries.length, Math.ceil(entries.length * clamp(budget, 0.01, 0.95))));
  return [...entries]
    .sort((left, right) => hash32(`${seedKey}:${left.trackId}:${left.id}`) - hash32(`${seedKey}:${right.trackId}:${right.id}`))
    .slice(0, count);
}

function canChangePitch(entry, locks) {
  if (locks.has("harmony")) return false;
  if (locks.has("melody") && entry.trackId === "melody") return false;
  return true;
}

function canChangeRhythm(locks) {
  return !locks.has("rhythm");
}

function nudgeWithinSection(note, amount, range) {
  const duration = eventDuration(note);
  const next = clamp(eventStart(note) + amount, range.start, Math.max(range.start, range.end - duration - 0.001));
  setEventStart(note, Number(next.toFixed(5)));
}

function shiftOctave(note, direction) {
  const pitch = eventPitch(note);
  const shifted = pitch + Math.sign(direction) * 12;
  if (shifted < 0 || shifted > 127) return false;
  setEventPitch(note, shifted);
  return true;
}

function nextCloneId(note, suffix) {
  if (note?.id != null) return `${note.id}-${suffix}`;
  if (note?.noteId != null) return `${note.noteId}-${suffix}`;
  if (note?.uid != null) return `${note.uid}-${suffix}`;
  return null;
}

function assignCloneId(note, id) {
  if (!id) return;
  if (Object.prototype.hasOwnProperty.call(note, "id")) note.id = id;
  else if (Object.prototype.hasOwnProperty.call(note, "noteId")) note.noteId = id;
  else if (Object.prototype.hasOwnProperty.call(note, "uid")) note.uid = id;
  else note.id = id;
}

function applyDirection(candidate, intent, eligible, seed) {
  const direction = intent.direction?.id;
  if (!direction) return { changedIds: [], inserted: 0, deleted: 0 };

  const locks = new Set(intent.preserve);
  const selected = chooseRewriteEntries(eligible.entries, intent.size.rewriteBudget, `${seed}:${direction}:${intent.size.id}`);
  const changedIds = new Set();
  let inserted = 0;
  let deleted = 0;
  const strength = intent.size.rewriteBudget;
  const rhythmUnlocked = canChangeRhythm(locks);

  const mark = (entry) => changedIds.add(`${entry.trackId}:${entry.id}`);
  const raiseVelocity = (entry, amount) => {
    setEventVelocity(entry.note, eventVelocity(entry.note) + amount);
    mark(entry);
  };

  if (direction === "moreBounce") {
    selected.forEach((entry, index) => {
      if (rhythmUnlocked) nudgeWithinSection(entry.note, (index % 2 ? 1 : -1) * (0.02 + strength * 0.08), eligible.range);
      raiseVelocity(entry, index % 2 ? 8 : -3);
    });
  } else if (direction === "harder") {
    selected.forEach((entry) => {
      raiseVelocity(entry, 10 + Math.round(strength * 18));
      if (canChangePitch(entry, locks) && ["melody", "counterpoint"].includes(entry.trackId) && strength > 0.4) shiftOctave(entry.note, 1);
      if (rhythmUnlocked) setEventDuration(entry.note, eventDuration(entry.note) * (0.96 - strength * 0.12));
    });
  } else if (direction === "darker" || direction === "brighter") {
    selected.forEach((entry) => {
      if (canChangePitch(entry, locks) && entry.trackId !== "drums" && shiftOctave(entry.note, direction === "darker" ? -1 : 1)) mark(entry);
      if (direction === "darker") raiseVelocity(entry, -4);
      else raiseVelocity(entry, 4);
    });
  } else if (direction === "buildUp") {
    const span = Math.max(0.001, eligible.range.end - eligible.range.start);
    selected.forEach((entry) => {
      const position = clamp((eventStart(entry.note) - eligible.range.start) / span, 0, 1);
      const amount = direction === "buildUp"
        ? 4 + Math.round((8 + 18 * strength) * position)
        : -(6 + Math.round((8 + 14 * strength) * position));
      raiseVelocity(entry, amount);
    });
  } else if (direction === "moreEmotional") {
    selected.forEach((entry, index) => {
      const contour = index % 3 === 0 ? 12 : index % 3 === 1 ? 4 : -2;
      raiseVelocity(entry, contour);
      if (canChangePitch(entry, locks) && ["melody", "counterpoint"].includes(entry.trackId) && strength > 0.65 && index % 4 === 0) {
        if (shiftOctave(entry.note, 1)) mark(entry);
      }
      if (rhythmUnlocked) setEventDuration(entry.note, Math.min(eligible.range.end - eventStart(entry.note), eventDuration(entry.note) * (1.04 + strength * 0.18)));
    });
  } else if (direction === "simpler" || direction === "moreSpace" || direction === "calmDown") {
    if (rhythmUnlocked) {
      const removalKeys = new Set(selected.filter((_, index) => index % 2 === 1).map((entry) => `${entry.trackId}:${entry.id}`));
      for (const track of sourceTracks(candidate)) {
        if (!Array.isArray(track.notes)) continue;
        const trackId = String(track.id);
        const before = track.notes.length;
        track.notes = track.notes.filter((note, index) => !removalKeys.has(`${trackId}:${noteIdentity(note, index)}`));
        deleted += before - track.notes.length;
      }
    }
    selected.forEach((entry, index) => {
      if (index % 2 === 0) {
        raiseVelocity(entry, direction === "simpler" ? -3 : -7);
        if (rhythmUnlocked && direction === "moreSpace") {
          const maxDuration = Math.max(0.03125, eligible.range.end - eventStart(entry.note));
          setEventDuration(entry.note, Math.min(maxDuration, eventDuration(entry.note) * (1.08 + strength * 0.24)));
        }
      }
    });
  } else if (direction === "busier" || direction === "catchier") {
    selected.forEach((entry, index) => {
      raiseVelocity(entry, direction === "catchier" ? 6 : 3);
      if (!rhythmUnlocked || index % 2 !== 0) return;
      const copy = cloneValue(entry.note);
      const offset = direction === "catchier" ? 1 : 0.5;
      const start = eventStart(entry.note) + offset;
      if (start >= eligible.range.end - 0.05) return;
      setEventStart(copy, start);
      setEventVelocity(copy, Math.max(1, eventVelocity(entry.note) - (direction === "catchier" ? 4 : 10)));
      assignCloneId(copy, nextCloneId(entry.note, `${direction}-${index + 1}`));
      entry.track.notes.push(copy);
      inserted += 1;
    });
    sourceTracks(candidate).forEach((track) => track.notes?.sort?.((a, b) => eventStart(a) - eventStart(b)));
  }

  return { changedIds: [...changedIds], inserted, deleted };
}

function scopeSnapshot(song, selection) {
  const range = sectionRange(song, selection.sectionId);
  if (!range) return null;
  const targetIds = new Set(targetedTrackIds(song, selection));
  const allowedIds = selection.target === "notes" ? new Set(selection.noteIds) : null;
  return sourceTracks(song).flatMap((track) => {
    const trackId = String(track?.id);
    if (!targetIds.has(trackId)) return [];
    return (track.notes ?? []).flatMap((note, index) => {
      const start = eventStart(note);
      const id = noteIdentity(note, index);
      if (start < range.start - 1e-7 || start >= range.end - 1e-7) return [];
      if (allowedIds && !allowedIds.has(id)) return [];
      return [{ trackId, id, note: cloneValue(note) }];
    });
  });
}

function outsideScopeDigest(song, selection) {
  const range = sectionRange(song, selection.sectionId);
  if (!range) return "";
  const targetIds = new Set(targetedTrackIds(song, selection));
  const allowedIds = selection.target === "notes" ? new Set(selection.noteIds) : null;
  const payload = sourceTracks(song).map((track) => {
    const trackId = String(track?.id);
    return {
      id: trackId,
      program: track?.program,
      settings: track?.settings,
      notes: (track.notes ?? []).filter((note, index) => {
        const start = eventStart(note);
        const id = noteIdentity(note, index);
        const inSection = start >= range.start - 1e-7 && start < range.end - 1e-7;
        const targetedTrack = targetIds.has(trackId);
        const selectedNote = allowedIds ? allowedIds.has(id) : true;
        return !(inSection && targetedTrack && selectedNote);
      }),
    };
  });
  return JSON.stringify(payload);
}

function validateCandidate(sourceSong, candidate, intent, beforeDigest) {
  if (!candidate || !Array.isArray(candidate.tracks)) return { valid: false, error: "invalid-candidate" };
  if (outsideScopeDigest(candidate, intent.selection) !== beforeDigest) {
    return { valid: false, error: "scope-escape" };
  }
  for (const track of candidate.tracks) {
    for (const note of track?.notes ?? []) {
      const pitch = note?.pitch ?? note?.note ?? note?.midi;
      if (pitch != null && (eventPitch(note) < 0 || eventPitch(note) > 127)) return { valid: false, error: "midi-pitch-out-of-range" };
      if (eventVelocity(note) < 1 || eventVelocity(note) > MIDI_NOTE_VELOCITY_MAX) return { valid: false, error: "midi-velocity-out-of-range" };
      if (eventDuration(note) <= 0) return { valid: false, error: "invalid-note-duration" };
    }
  }
  if (intent.preserve.includes("instrument")) {
    const sourcePrograms = sourceTracks(sourceSong).map((track) => [String(track.id), track.program]);
    const candidatePrograms = new Map(sourceTracks(candidate).map((track) => [String(track.id), track.program]));
    if (sourcePrograms.some(([id, program]) => candidatePrograms.get(id) !== program)) return { valid: false, error: "instrument-lock-broken" };
  }
  return { valid: true };
}

/**
 * Generate one non-destructive local Shape candidate. The input song is never
 * mutated; the returned transaction owns both Before and After snapshots so UI
 * audition can switch instantly without writing to history until Accept.
 */
export function createShapeCandidate(sourceSong, shapeInput = {}, { seed = "shape" } = {}) {
  if (!sourceSong || typeof sourceSong !== "object") {
    return { status: "rejected", error: "invalid-song" };
  }

  let intent;
  try {
    intent = shapeInput?.version === 1 && shapeInput?.selection && shapeInput?.size
      ? shapeInput
      : createShapeIntent(shapeInput);
  } catch (error) {
    return { status: "rejected", error: "invalid-intent", message: error?.message ?? String(error) };
  }

  if (!intent.direction) return { status: "rejected", error: "direction-required", intent };
  const candidate = cloneValue(sourceSong);
  const eligible = collectEligible(candidate, intent.selection);
  if (eligible.error) return { status: "rejected", error: eligible.error, intent, missing: eligible.missing ?? [] };

  const beforeDigest = outsideScopeDigest(sourceSong, intent.selection);
  const beforeScope = scopeSnapshot(sourceSong, intent.selection);
  const mutation = applyDirection(candidate, intent, eligible, `${seed}:${sourceSong.id ?? sourceSong.seed ?? "song"}`);
  const afterScope = scopeSnapshot(candidate, intent.selection);
  const changed = JSON.stringify(beforeScope) !== JSON.stringify(afterScope);
  if (!changed) return { status: "rejected", error: "no-musical-change", intent };

  const validation = validateCandidate(sourceSong, candidate, intent, beforeDigest);
  if (!validation.valid) return { status: "rejected", error: validation.error, intent };

  candidate.shapeRevision = {
    version: 1,
    parentSongId: sourceSong.id ?? null,
    sectionId: intent.selection.sectionId,
    target: intent.selection.target,
    trackId: intent.selection.trackId,
    size: intent.size.id,
    direction: intent.direction.id,
    preserve: [...intent.preserve],
  };

  return {
    status: "candidate",
    id: `shape-${hash32(`${seed}:${sourceSong.id ?? sourceSong.seed ?? "song"}:${intent.selection.sectionId}:${intent.direction.id}:${intent.size.id}`).toString(16)}`,
    intent,
    before: cloneValue(sourceSong),
    after: candidate,
    summary: {
      changedNoteCount: mutation.changedIds.length,
      insertedNoteCount: mutation.inserted,
      deletedNoteCount: mutation.deleted,
      scopeNoteCount: eligible.entries.length,
      rewriteBudget: intent.size.rewriteBudget,
    },
  };
}

export function auditionShapeCandidate(transaction, side = "after") {
  if (transaction?.status !== "candidate") return null;
  return cloneValue(side === "before" ? transaction.before : transaction.after);
}

export function acceptShapeCandidate(transaction) {
  return auditionShapeCandidate(transaction, "after");
}

export function rejectShapeCandidate(transaction) {
  return auditionShapeCandidate(transaction, "before");
}
