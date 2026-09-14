const RETURN_RELATIONSHIPS = new Set(["recall", "return"]);
const PAYOFF_NAMES = new Set(["chorus", "drop", "theme", "idea"]);

export const MAX_RETURN_DEVELOPMENT_CANDIDATES = 3;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function sectionsOf(song) {
  return Array.isArray(song?.structure) ? song.structure : Array.isArray(song?.sections) ? song.sections : [];
}

function trackOf(song, id) {
  return song?.tracks?.find?.((track) => String(track?.id) === id) ?? null;
}

function sectionById(song, id) {
  return sectionsOf(song).find((section) => String(section?.id) === String(id)) ?? null;
}

function sectionStart(section) {
  return finite(section?.startBeat, 0);
}

function sectionEnd(section) {
  return finite(section?.endBeat, sectionStart(section));
}

function noteStart(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time, 0);
}

function setNoteStart(note, value) {
  const key = ["start", "startBeat", "beat", "time"].find((candidate) => Object.prototype.hasOwnProperty.call(note, candidate)) ?? "start";
  note[key] = round(value);
}

function notePitch(note) {
  return finite(note?.pitch ?? note?.note ?? note?.midi, 60);
}

function setNotePitch(note, value) {
  const key = ["pitch", "note", "midi"].find((candidate) => Object.prototype.hasOwnProperty.call(note, candidate)) ?? "pitch";
  note[key] = Math.round(clamp(value, 0, 127));
}

function noteDuration(note) {
  return finite(note?.duration ?? note?.length, 0.25);
}

function setNoteDuration(note, value) {
  const key = Object.prototype.hasOwnProperty.call(note, "length") ? "length" : "duration";
  note[key] = round(Math.max(0.02, value));
}

function noteVelocity(note) {
  const value = finite(note?.velocity ?? note?.vel, 90);
  return value <= 1 ? value * 127 : value;
}

function setNoteVelocity(note, value) {
  const key = Object.prototype.hasOwnProperty.call(note, "vel") ? "vel" : "velocity";
  const bounded = Math.round(clamp(value, 1, 127));
  note[key] = finite(note?.[key], 90) <= 1 ? round(bounded / 127) : bounded;
}

function normalizedName(section) {
  return String(section?.name ?? section?.type ?? "idea").toLowerCase();
}

function returnPairs(song) {
  const sections = sectionsOf(song);
  const memory = Array.isArray(song?.memoryMap) ? song.memoryMap : [];
  const memoryPairs = memory
    .filter((entry) => RETURN_RELATIONSHIPS.has(String(entry?.relationship)))
    .map((entry) => ({
      target: sectionById(song, entry.sectionId),
      origin: sectionById(song, entry.originSectionId),
      relationship: String(entry.relationship),
    }))
    .filter(({ target, origin }) => target && origin && target.id !== origin.id);
  if (memoryPairs.length) return memoryPairs;

  const firstByName = new Map();
  const pairs = [];
  for (const section of sections) {
    const name = normalizedName(section);
    const origin = firstByName.get(name);
    if (!origin) firstByName.set(name, section);
    else pairs.push({ target: section, origin, relationship: "recall" });
  }
  return pairs;
}

function notesInSection(track, section) {
  const start = sectionStart(section);
  const end = sectionEnd(section);
  return (track?.notes ?? [])
    .filter((note) => noteStart(note) >= start - 1e-6 && noteStart(note) < end - 1e-6)
    .sort((left, right) => noteStart(left) - noteStart(right) || notePitch(left) - notePitch(right));
}

function harmonyAt(song, beat) {
  const harmony = Array.isArray(song?.harmony) ? song.harmony : [];
  let result = harmony[0] ?? null;
  for (const event of harmony) {
    const start = finite(event?.start, 0);
    const duration = finite(event?.duration, 0);
    if (start <= beat + 1e-6) result = event;
    if (beat >= start - 1e-6 && beat < start + duration - 1e-6) return event;
  }
  return result;
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function scalePitchClasses(song) {
  const tonic = Math.round(finite(song?.meta?.keyPc, 0));
  const intervals = Array.isArray(song?.meta?.scaleIntervals) ? song.meta.scaleIntervals : [];
  if (!intervals.length) return new Set(Array.from({ length: 12 }, (_, index) => index));
  return new Set(intervals.map((interval) => mod(tonic + Math.round(finite(interval)), 12)));
}

function nearestPitchForClasses(sourcePitch, classes) {
  const values = [...classes];
  if (!values.length) return sourcePitch;
  let best = sourcePitch;
  let bestDistance = Infinity;
  for (let delta = -12; delta <= 12; delta += 1) {
    const candidate = sourcePitch + delta;
    if (candidate < 0 || candidate > 127 || !classes.has(mod(candidate, 12))) continue;
    const distance = Math.abs(delta);
    if (distance < bestDistance || (distance === bestDistance && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function applyCadencePayoff(song, pairs) {
  const melody = trackOf(song, "melody");
  if (!melody?.notes?.length) return 0;
  const barBeats = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const scalePcs = scalePitchClasses(song);
  const tonicPc = mod(finite(song?.meta?.keyPc, 0), 12);
  let changed = 0;

  for (const { target, relationship } of pairs) {
    const targetNotes = notesInSection(melody, target);
    const landing = targetNotes.at(-1);
    if (!landing) continue;
    const beat = noteStart(landing);
    const chord = harmonyAt(song, beat);
    const chordPcs = new Set((chord?.tones ?? [])
      .map((tone) => mod(finite(tone), 12))
      .filter((tone) => scalePcs.has(tone)));
    if (PAYOFF_NAMES.has(normalizedName(target)) && chordPcs.has(tonicPc)) chordPcs.clear(), chordPcs.add(tonicPc);
    if (!chordPcs.size) chordPcs.add(tonicPc);
    const currentPitch = Math.round(notePitch(landing));
    const targetPitch = nearestPitchForClasses(currentPitch, chordPcs);
    const end = sectionEnd(target);
    const desiredDuration = Math.min(end - beat, Math.max(noteDuration(landing), barBeats * 0.4));
    const pitchChanged = targetPitch !== currentPitch && Math.abs(targetPitch - currentPitch) <= 7;
    const durationChanged = desiredDuration > noteDuration(landing) + 1e-6;
    if (pitchChanged) setNotePitch(landing, targetPitch);
    if (durationChanged) setNoteDuration(landing, desiredDuration);
    if (pitchChanged || durationChanged) {
      setNoteVelocity(landing, noteVelocity(landing) + (relationship === "return" ? 4 : 2));
      landing.returnDevelopmentRole = "cadence-payoff";
      landing.returnDevelopmentOriginSectionId = String(pairs.find((pair) => pair.target.id === target.id)?.origin?.id ?? "");
      changed += 1;
    }
  }
  return changed;
}

function quarterBeatOffset(note, windowStart) {
  return Math.round((noteStart(note) - windowStart) * 4) / 4;
}

function signatureForWindow(notes, windowStart) {
  return new Set(notes.map((note) => `${quarterBeatOffset(note, windowStart)}`));
}

function referenceMotifSignature(song, melody, motifLength) {
  for (const section of sectionsOf(song)) {
    const repeats = Math.min(4, Math.floor((sectionEnd(section) - sectionStart(section)) / motifLength));
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const start = sectionStart(section) + repeat * motifLength;
      const notes = notesInSection(melody, section)
        .filter((note) => noteStart(note) >= start - 1e-6 && noteStart(note) < start + motifLength - 1e-6);
      if (notes.length >= 2) return signatureForWindow(notes, start);
    }
  }
  return null;
}

function signatureCoverage(signature, reference) {
  if (!signature?.size || !reference?.size) return 0;
  const shared = [...reference].filter((item) => signature.has(item)).length;
  return shared / Math.max(1, Math.min(reference.size, signature.size));
}

function alignWindowToReference(notes, windowStart, windowEnd, reference, maxChanges, originId) {
  if (notes.length < 2 || !reference?.size || maxChanges <= 0) return 0;
  const before = signatureForWindow(notes, windowStart);
  if (signatureCoverage(before, reference) >= 1 - 1e-6) return 0;
  const moved = new Set();
  const originalStarts = new Map();
  let changed = 0;

  while (changed < maxChanges) {
    const counts = new Map();
    for (const note of notes) {
      const offset = `${quarterBeatOffset(note, windowStart)}`;
      counts.set(offset, (counts.get(offset) ?? 0) + 1);
    }
    const current = new Set(counts.keys());
    if (signatureCoverage(current, reference) >= 1 - 1e-6) break;
    const missing = [...reference].map(Number).filter((offset) => !current.has(`${offset}`));
    if (!missing.length) break;

    const movable = notes.filter((note) => {
      if (moved.has(note)) return false;
      const offset = `${quarterBeatOffset(note, windowStart)}`;
      return !reference.has(offset) || (counts.get(offset) ?? 0) > 1;
    });
    if (!movable.length) break;

    let best = null;
    for (const note of movable) {
      const currentStart = noteStart(note);
      for (const offset of missing) {
        const desired = windowStart + offset;
        const shift = Math.abs(desired - currentStart);
        if (desired < windowStart - 1e-6 || desired >= windowEnd - 0.03 || shift > 0.75) continue;
        if (!best || shift < best.shift - 1e-6 || (Math.abs(shift - best.shift) <= 1e-6 && desired < best.desired)) {
          best = { note, desired, shift };
        }
      }
    }
    if (!best) break;

    if (!originalStarts.has(best.note)) originalStarts.set(best.note, noteStart(best.note));
    setNoteStart(best.note, best.desired);
    best.note.returnDevelopmentRole = "techno-grid-recall";
    best.note.returnDevelopmentOriginSectionId = String(originId);
    moved.add(best.note);
    changed += 1;
  }

  const after = signatureForWindow(notes, windowStart);
  if (signatureCoverage(after, reference) <= signatureCoverage(before, reference) + 1e-6) {
    for (const note of moved) {
      setNoteStart(note, originalStarts.get(note));
      delete note.returnDevelopmentRole;
      delete note.returnDevelopmentOriginSectionId;
    }
    return 0;
  }
  return changed;
}

function applyRhythmicRecall(song, pairs) {
  const melody = trackOf(song, "melody");
  if (!melody?.notes?.length) return 0;
  const motifLength = clamp(finite(song?.motifs?.melody?.lengthBeats, finite(song?.meta?.beatsPerBar, 4)), 1, 8);
  const genre = String(song?.genre ?? song?.meta?.genre ?? "pop");
  const technoGridRecall = genre === "techno";
  const maxRepeats = technoGridRecall ? 4 : 1;
  const maxChangedPerTarget = technoGridRecall ? 16 : 8;
  const criticReference = technoGridRecall ? referenceMotifSignature(song, melody, motifLength) : null;
  let changed = 0;

  for (const { target, origin } of pairs) {
    const sourceStart = sectionStart(origin);
    const targetStart = sectionStart(target);
    const targetEnd = sectionEnd(target);
    const source = notesInSection(melody, origin)
      .filter((note) => noteStart(note) < sourceStart + motifLength - 1e-6)
      .slice(0, 8);
    if (source.length < 2) continue;

    const repeatCount = Math.min(maxRepeats, Math.max(1, Math.floor((targetEnd - targetStart) / motifLength)));
    let changedInTarget = 0;
    for (let repeat = 0; repeat < repeatCount && changedInTarget < maxChangedPerTarget; repeat += 1) {
      const repeatStart = targetStart + repeat * motifLength;
      const repeatEnd = Math.min(targetEnd, repeatStart + motifLength);
      const destination = notesInSection(melody, target)
        .filter((note) => noteStart(note) >= repeatStart - 1e-6 && noteStart(note) < repeatEnd - 1e-6);
      if (destination.length < 2) continue;

      if (technoGridRecall && criticReference?.size) {
        const aligned = alignWindowToReference(
          destination,
          repeatStart,
          repeatEnd,
          criticReference,
          maxChangedPerTarget - changedInTarget,
          origin.id,
        );
        changed += aligned;
        changedInTarget += aligned;
        continue;
      }

      const count = Math.min(source.length, destination.length, maxChangedPerTarget - changedInTarget);
      let previousStart = repeatStart - 1e-4;
      for (let index = 0; index < count; index += 1) {
        const sourceOffset = noteStart(source[index]) - sourceStart;
        const desired = clamp(repeatStart + sourceOffset, repeatStart, repeatEnd - 0.03);
        const nextStart = Math.max(previousStart + 0.02, desired);
        if (Math.abs(noteStart(destination[index]) - nextStart) > 1e-6) {
          setNoteStart(destination[index], nextStart);
          destination[index].returnDevelopmentRole = "rhythmic-recall";
          destination[index].returnDevelopmentOriginSectionId = String(origin.id);
          changed += 1;
          changedInTarget += 1;
        }
        previousStart = nextStart;
      }
    }
  }
  melody.notes.sort((left, right) => noteStart(left) - noteStart(right) || notePitch(left) - notePitch(right));
  return changed;
}

function grooveOffsetsForGenre(genre) {
  if (genre === "house") return [0.5];
  if (["trap", "drill"].includes(genre)) return [0, 0.25];
  if (genre === "techno") return [0, 0.5];
  return [0, 0.25, 0.5, 0.75];
}

function applyGrooveLock(song, pairs) {
  const bass = trackOf(song, "bass");
  const drums = trackOf(song, "drums");
  if (!bass?.notes?.length || !drums?.notes?.length) return 0;
  const kicks = drums.notes.filter((note) => [35, 36].includes(Math.round(notePitch(note))));
  if (!kicks.length) return 0;
  const offsets = grooveOffsetsForGenre(String(song?.genre ?? song?.meta?.genre ?? "pop"));
  const barBeats = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  let changed = 0;

  for (const { target, origin } of pairs) {
    const targetStart = sectionStart(target);
    const windowEnd = Math.min(sectionEnd(target), targetStart + barBeats * 2);
    const notes = notesInSection(bass, target)
      .filter((note) => noteStart(note) < windowEnd - 1e-6)
      .slice(0, 6);
    const targetKicks = kicks.filter((kick) => noteStart(kick) >= targetStart - 0.75 && noteStart(kick) < windowEnd + 0.01);
    for (const note of notes) {
      const current = noteStart(note);
      const candidates = targetKicks.flatMap((kick) => offsets.map((offset) => noteStart(kick) + offset))
        .filter((start) => start >= targetStart - 1e-6 && start < sectionEnd(target) - 0.03)
        .sort((left, right) => Math.abs(left - current) - Math.abs(right - current) || left - right);
      const nearest = candidates[0];
      if (!Number.isFinite(nearest) || Math.abs(nearest - current) > 0.18 || Math.abs(nearest - current) < 0.012) continue;
      setNoteStart(note, nearest);
      note.returnDevelopmentRole = "groove-lock";
      note.returnDevelopmentOriginSectionId = String(origin.id);
      changed += 1;
    }
  }
  bass.notes.sort((left, right) => noteStart(left) - noteStart(right) || notePitch(left) - notePitch(right));
  return changed;
}

function makeCandidate(sourceSong, pairs, id, apply) {
  const song = clone(sourceSong);
  const changedNotes = apply(song, returnPairs(song));
  if (!changedNotes) return null;
  song.outputQualityEvolution = {
    ...(song.outputQualityEvolution ?? {}),
    returnDevelopment: {
      id,
      changedNotes,
      returnSections: pairs.length,
    },
  };
  return Object.freeze({ id, song, changedNotes, returnSections: pairs.length });
}

/**
 * Create at most three focused return-section candidates. Each candidate fixes
 * one measurable quality axis and leaves harmony, song length, section order,
 * and all unrelated notes untouched. The caller must critic/release-gate them.
 */
export function createReturnDevelopmentCandidates(sourceSong, config = {}) {
  if (config.returnDevelopment !== true) return [];
  const pairs = returnPairs(sourceSong);
  if (!pairs.length) return [];
  const definitions = [
    ["cadence-payoff", applyCadencePayoff],
    ["rhythmic-recall", applyRhythmicRecall],
    ["groove-lock", applyGrooveLock],
  ];
  return definitions
    .map(([id, apply]) => makeCandidate(sourceSong, pairs, id, apply))
    .filter(Boolean)
    .slice(0, MAX_RETURN_DEVELOPMENT_CANDIDATES);
}

export function returnDevelopmentTargets(song) {
  return returnPairs(song).map(({ target, origin, relationship }) => Object.freeze({
    sectionId: String(target.id),
    sectionName: normalizedName(target),
    originSectionId: String(origin.id),
    relationship,
  }));
}
