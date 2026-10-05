import { cloneValue } from "./clone-value.js";
export const MAX_GROOVE_POCKET_CANDIDATES = 3;

const POCKET_PROFILES = Object.freeze([
  Object.freeze({ id: "tight-pocket", maxShift: 0.1, changesPerBar: 0.75 }),
  Object.freeze({ id: "balanced-pocket", maxShift: 0.15, changesPerBar: 1 }),
  Object.freeze({ id: "deep-pocket", maxShift: 0.2, changesPerBar: 1.25 }),
]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function noteStart(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time, 0);
}

function setNoteStart(note, value) {
  const key = ["start", "startBeat", "beat", "time"].find((candidate) => Object.prototype.hasOwnProperty.call(note, candidate)) ?? "start";
  note[key] = round(value);
}

function notePitch(note) {
  return Math.round(finite(note?.pitch ?? note?.note ?? note?.midi, 60));
}

function trackOf(song, id) {
  return song?.tracks?.find?.((track) => String(track?.id) === id) ?? null;
}

export function applyInstrumentMicroTiming(song, {
  laidBack = false,
} = {}) {
  const candidate = cloneValue(song);
  const beatsPerBar = Math.max(1, finite(candidate?.meta?.beatsPerBar, 4));
  if (!laidBack) return candidate;
  for (const track of candidate?.tracks ?? []) {
    const shift = track?.id === "drums" ? 0.025 : track?.id === "bass" ? 0.015 : 0;
    if (!shift) continue;
    track.notes = (track.notes ?? []).map((note) => {
      const current = noteStart(note);
      const barStart = Math.floor(current / beatsPerBar) * beatsPerBar;
      const barEnd = barStart + beatsPerBar - 0.001;
      const nextStart = round(Math.min(barEnd, current + shift), 4);
      return {
        ...note,
        start: nextStart,
        microTimingShiftBeats: round(nextStart - current, 4),
      };
    });
  }
  return candidate;
}

function sectionsOf(song) {
  return Array.isArray(song?.structure) ? song.structure : Array.isArray(song?.sections) ? song.sections : [];
}

function sectionStart(section) {
  return finite(section?.startBeat, 0);
}

function sectionEnd(section) {
  return finite(section?.endBeat, sectionStart(section));
}

function sectionForBeat(song, beat) {
  return sectionsOf(song).find((section) => beat >= sectionStart(section) - 1e-6 && beat < sectionEnd(section) - 1e-6) ?? null;
}

const POCKET_RELATIONSHIPS = Object.freeze({
  hipHop: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([0.25, 0.5]), maxReplyShare: 0.48 }),
  trap: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([0.25]), maxReplyShare: 0.42 }),
  drill: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([0.25]), maxReplyShare: 0.42 }),
  pop: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([0.5]), maxReplyShare: 0.34 }),
  house: Object.freeze({ lock: Object.freeze([]), reply: Object.freeze([0.5]), maxReplyShare: 1 }),
  techno: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([0.5]), maxReplyShare: 0.55 }),
  neoSoul: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([0.25, 0.5]), maxReplyShare: 0.58 }),
  rnbSoul: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([0.25, 0.5]), maxReplyShare: 0.58 }),
  reggaeton: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([0.5]), maxReplyShare: 0.48 }),
  afrobeats: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([0.25, 0.5]), maxReplyShare: 0.56 }),
  rock: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([]), maxReplyShare: 0 }),
  drumBass: Object.freeze({ lock: Object.freeze([0]), reply: Object.freeze([0.25, 0.5]), maxReplyShare: 0.48 }),
});
function grooveRelationship(genre) {
  return POCKET_RELATIONSHIPS[String(genre ?? "")] ?? Object.freeze({
    lock: Object.freeze([0]),
    reply: Object.freeze([0.25, 0.5]),
    maxReplyShare: 0.5,
  });
}
function grooveOffsets(genre) {
  const relationship = grooveRelationship(genre);
  return [...new Set([...relationship.lock, ...relationship.reply])].sort((left, right) => left - right);
}
function classifyPocketTarget(beat, kicks, relationship, tolerance = 0.075) {
  const lock = kicks.some((kick) => relationship.lock.some(
    (offset) => Math.abs(beat - (noteStart(kick) + offset)) <= tolerance,
  ));
  if (lock) return "lock";
  const reply = kicks.some((kick) => relationship.reply.some(
    (offset) => Math.abs(beat - (noteStart(kick) + offset)) <= tolerance,
  ));
  return reply ? "reply" : "independent";
}
function pocketRelationshipStats(notes, kicks, relationship) {
  const counts = { lock: 0, reply: 0, independent: 0 };
  for (const note of notes) counts[classifyPocketTarget(noteStart(note), kicks, relationship)] += 1;
  const total = Math.max(1, notes.length);
  return Object.freeze({
    ...counts,
    lockRatio: round(counts.lock / total),
    replyRatio: round(counts.reply / total),
    independentRatio: round(counts.independent / total),
  });
}

function kickNotes(song) {
  return (trackOf(song, "drums")?.notes ?? [])
    .filter((note) => [35, 36].includes(notePitch(note)))
    .sort((left, right) => noteStart(left) - noteStart(right));
}

function bassNotes(song) {
  return (trackOf(song, "bass")?.notes ?? [])
    .sort((left, right) => noteStart(left) - noteStart(right) || notePitch(left) - notePitch(right));
}

function candidateTargets(song, kicks, offsets) {
  return kicks.flatMap((kick) => offsets.map((offset) => noteStart(kick) + offset))
    .filter((beat) => beat >= -1e-6 && beat < finite(song?.meta?.totalBeats, Infinity) - 0.02)
    .sort((left, right) => left - right);
}

function onsetMatchRatio(notes, targets, tolerance = 0.075) {
  if (!notes.length || !targets.length) return 0;
  const matched = notes.filter((note) => targets.some((target) => Math.abs(noteStart(note) - target) <= tolerance)).length;
  return matched / notes.length;
}

function hasBassCollision(notes, moving, desired) {
  return notes.some((note) => note !== moving && Math.abs(noteStart(note) - desired) < 0.03);
}

function createPocketCandidate(sourceSong, profile) {
  const song = cloneValue(sourceSong);
  const bass = bassNotes(song);
  const kicks = kickNotes(song);
  if (!bass.length || !kicks.length) return null;

  const genre = String(song?.genre ?? song?.meta?.genre ?? "pop");
  const relationship = grooveRelationship(genre);
  const offsets = grooveOffsets(genre);
  const targets = candidateTargets(song, kicks, offsets);
  if (!targets.length) return null;
  const beforeLock = onsetMatchRatio(bass, targets);
  const beforeRelationship = pocketRelationshipStats(bass, kicks, relationship);
  const bars = Math.max(1, Math.ceil(finite(song?.bars, finite(song?.meta?.bars, finite(song?.meta?.totalBeats, 4) / Math.max(1, finite(song?.meta?.beatsPerBar, 4))))));
  const maxChanges = Math.min(32, Math.max(1, Math.ceil(bars * profile.changesPerBar)));

  const opportunities = [];
  for (const note of bass) {
    if (targets.some((target) => Math.abs(noteStart(note) - target) <= 0.075)) continue;
    const section = sectionForBeat(song, noteStart(note));
    if (!section) continue;
    const current = noteStart(note);
    const nearest = targets
      .filter((target) => target >= sectionStart(section) - 1e-6 && target < sectionEnd(section) - 0.02)
      .map((target) => ({ target, shift: Math.abs(target - current) }))
      .filter(({ shift }) => shift > 0.075 + 1e-6 && shift <= profile.maxShift + 1e-6)
      .sort((left, right) => left.shift - right.shift || left.target - right.target)[0];
    if (!nearest) continue;
    opportunities.push({ note, desired: nearest.target, shift: nearest.shift, sectionId: String(section.id ?? "") });
  }

  opportunities.sort((left, right) => left.shift - right.shift || noteStart(left.note) - noteStart(right.note));
  let changedNotes = 0;
  for (const opportunity of opportunities) {
    if (changedNotes >= maxChanges) break;
    if (hasBassCollision(bass, opportunity.note, opportunity.desired)) continue;
    setNoteStart(opportunity.note, opportunity.desired);
    opportunity.note.groovePocketRole = profile.id;
    opportunity.note.groovePocketSectionId = opportunity.sectionId;
    changedNotes += 1;
  }
  if (!changedNotes) return null;

  bass.sort((left, right) => noteStart(left) - noteStart(right) || notePitch(left) - notePitch(right));
  const afterLock = onsetMatchRatio(bass, targets);
  const afterRelationship = pocketRelationshipStats(bass, kicks, relationship);
  if (afterLock <= beforeLock + 1e-9) return null;
  const replyCeiling = relationship.maxReplyShare + 0.08;
  if (afterRelationship.replyRatio > replyCeiling + 1e-9) return null;

  song.outputQualityEvolution = {
    ...(song.outputQualityEvolution ?? {}),
    groovePocket: {
      id: profile.id,
      changedNotes,
      maxShift: profile.maxShift,
      beforeLock: round(beforeLock),
      afterLock: round(afterLock),
      lockDelta: round(afterLock - beforeLock),
      relationship: {
        before: beforeRelationship,
        after: afterRelationship,
        maxReplyShare: relationship.maxReplyShare,
      },
    },
  };

  return Object.freeze({
    id: profile.id,
    song,
    changedNotes,
    maxShift: profile.maxShift,
    beforeLock,
    afterLock,
    lockDelta: afterLock - beforeLock,
    relationshipBefore: beforeRelationship,
    relationshipAfter: afterRelationship,
    maxReplyShare: relationship.maxReplyShare,
  });
}

function pocketSignature(candidate) {
  return (trackOf(candidate?.song, "bass")?.notes ?? [])
    .map((note) => `${round(noteStart(note), 4)}:${notePitch(note)}`)
    .join("|");
}

/**
 * Phase 6D groove refinement is intentionally bass-only. It auditions up to
 * three bounded timing strengths against the kick grid the critic already
 * understands. It never creates/deletes notes, changes pitch, rewrites drums,
 * or crosses section boundaries. The caller must still critic/release-gate it.
 */
export function createGroovePocketCandidates(sourceSong, config = {}) {
  if (config.groovePocketRefinement !== true) return [];
  const candidates = POCKET_PROFILES.map((profile) => createPocketCandidate(sourceSong, profile)).filter(Boolean);
  const seen = new Set();
  return candidates.filter((candidate) => {
    const signature = pocketSignature(candidate);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  }).slice(0, MAX_GROOVE_POCKET_CANDIDATES);
}
