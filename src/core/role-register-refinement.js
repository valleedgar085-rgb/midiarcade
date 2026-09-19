import {
  rolePreferredRegisterWindow,
  roleRegisterWindow,
} from "./role-register-policy.js";

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function notePitch(note) {
  return Math.max(0, Math.min(127, Math.round(finite(note?.pitch, 60))));
}

function overlapsSamePitch(notes, current, candidatePitch) {
  const start = finite(current?.start);
  const end = start + Math.max(0.02, finite(current?.duration, 0.25));
  return (notes ?? []).some((other) => {
    if (other === current || notePitch(other) !== candidatePitch) return false;
    const otherStart = finite(other?.start);
    const otherEnd = otherStart + Math.max(0.02, finite(other?.duration, 0.25));
    return start < otherEnd - 1e-6 && otherStart < end - 1e-6;
  });
}

function sectionForNote(structure, note) {
  const beat = finite(note?.start);
  return (structure ?? []).find((section) => (
    beat >= finite(section?.startBeat) - 1e-6
    && beat < finite(section?.endBeat, Infinity) - 1e-6
  )) ?? null;
}

function intentionalRegisterLift(trackId, note, section) {
  if (!["melody", "counterpoint"].includes(String(trackId))) return false;
  return Boolean(
    finite(note?.plannedTension, 0) >= 0.76
    || ["peak", "release"].includes(String(section?.intent?.role ?? ""))
    || finite(section?.intent?.registerLift, 0) > 0
    || note?.ensembleCadenceRole
    || note?.resolutionRole
    || note?.transitionHandoffRole
  );
}

function octaveCandidates(sourcePitch, window, notes, currentNote) {
  const source = notePitch({ pitch: sourcePitch });
  const pitchClass = ((source % 12) + 12) % 12;
  const candidates = [];
  for (let pitch = pitchClass; pitch <= 127; pitch += 12) {
    if (pitch < window.min || pitch > window.max) continue;
    if (overlapsSamePitch(notes, currentNote, pitch)) continue;
    candidates.push(pitch);
  }
  return candidates;
}

function nearestPreferredCandidate(trackId, note, trackNotes, previousPitch, {
  forceHardWindow = false,
  allowPreferredException = false,
} = {}) {
  const hard = roleRegisterWindow(trackId);
  const preferred = rolePreferredRegisterWindow(trackId);
  if (!hard || !preferred) return notePitch(note);
  const source = notePitch(note);
  const candidates = octaveCandidates(source, hard, trackNotes, note);
  if (!candidates.length) return source;

  const targetMin = forceHardWindow || allowPreferredException ? hard.min : preferred.min;
  const targetMax = forceHardWindow || allowPreferredException ? hard.max : preferred.max;
  const center = (preferred.min + preferred.max) / 2;

  candidates.sort((left, right) => {
    const score = (pitch) => {
      const outside = pitch < targetMin ? targetMin - pitch : pitch > targetMax ? pitch - targetMax : 0;
      const movement = previousPitch == null ? 0 : Math.abs(pitch - previousPitch) * 0.16;
      const centerDistance = Math.abs(pitch - center) * 0.08;
      const rewrite = Math.abs(pitch - source) * 0.12;
      return outside * 12 + movement + centerDistance + rewrite;
    };
    return score(left) - score(right) || Math.abs(left - source) - Math.abs(right - source);
  });
  return candidates[0] ?? source;
}

export function analyzeRoleRegisters(tracks = []) {
  const byTrack = {};
  let hardViolations = 0;
  let preferredViolations = 0;
  for (const track of tracks ?? []) {
    const hard = roleRegisterWindow(track?.id);
    const preferred = rolePreferredRegisterWindow(track?.id);
    if (!hard || !preferred) continue;
    const pitches = (track.notes ?? []).map(notePitch);
    const hardCount = pitches.filter((pitch) => pitch < hard.min || pitch > hard.max).length;
    const preferredCount = pitches.filter((pitch) => pitch < preferred.min || pitch > preferred.max).length;
    hardViolations += hardCount;
    preferredViolations += preferredCount;
    byTrack[track.id] = Object.freeze({
      notes: pitches.length,
      minPitch: pitches.length ? Math.min(...pitches) : null,
      maxPitch: pitches.length ? Math.max(...pitches) : null,
      hardViolations: hardCount,
      preferredViolations: preferredCount,
      hardWindow: Object.freeze({ min: hard.min, max: hard.max }),
      preferredWindow: Object.freeze({ min: preferred.min, max: preferred.max }),
    });
  }
  return Object.freeze({
    hardViolations,
    preferredViolations,
    byTrack: Object.freeze(byTrack),
  });
}

/**
 * Final octave-only register pass. Pitch classes, timing, velocity and note
 * count remain untouched. Hard role windows always win; preferred windows only
 * correct the two audible fatigue cases we care about most: sub-bass notes that
 * are unnecessarily low and foreground notes that are unnecessarily high.
 */
export function refineRoleRegisters(tracks = [], structure = []) {
  const cloned = tracks.map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => ({ ...note })),
  }));
  const before = analyzeRoleRegisters(cloned);
  const correctionsByTrack = {};
  let corrections = 0;

  for (const track of cloned) {
    const hard = roleRegisterWindow(track.id);
    const preferred = rolePreferredRegisterWindow(track.id);
    if (!hard || !preferred || track.id === "drums") continue;
    let previousPitch = null;
    let trackCorrections = 0;
    const notes = [...(track.notes ?? [])].sort((left, right) => (
      finite(left.start) - finite(right.start) || notePitch(left) - notePitch(right)
    ));

    for (const note of notes) {
      const source = notePitch(note);
      const section = sectionForNote(structure, note);
      const hardViolation = source < hard.min || source > hard.max;
      const tooLowBass = track.id === "bass" && source < preferred.min;
      const tooHighForeground = ["melody", "counterpoint"].includes(track.id)
        && source > preferred.max
        && !intentionalRegisterLift(track.id, note, section);

      if (!hardViolation && !tooLowBass && !tooHighForeground) {
        previousPitch = source;
        continue;
      }

      const selected = nearestPreferredCandidate(track.id, note, track.notes, previousPitch, {
        forceHardWindow: hardViolation,
        allowPreferredException: intentionalRegisterLift(track.id, note, section),
      });
      if (selected !== source) {
        note.pitch = selected;
        note.registerIntegrityRepair = hardViolation
          ? "hard-role-window"
          : tooLowBass
            ? "bass-body-lift"
            : "foreground-fatigue-fold";
        corrections += 1;
        trackCorrections += 1;
      }
      previousPitch = notePitch(note);
    }
    correctionsByTrack[track.id] = trackCorrections;
    track.notes.sort((left, right) => finite(left.start) - finite(right.start) || notePitch(left) - notePitch(right));
  }

  let separationCorrections = 0;
  const bassTrack = cloned.find((track) => track.id === "bass");
  const chordTrack = cloned.find((track) => track.id === "chords");
  const chordWindow = roleRegisterWindow("chords");
  if (bassTrack?.notes?.length && chordTrack?.notes?.length && chordWindow) {
    for (const chord of chordTrack.notes) {
      const soundingBass = bassTrack.notes.filter((bass) => (
        finite(chord.start) < finite(bass.start) + Math.max(0.02, finite(bass.duration, 0.25))
        && finite(bass.start) < finite(chord.start) + Math.max(0.02, finite(chord.duration, 0.25))
      ));
      if (!soundingBass.length) continue;
      const bassCeiling = Math.max(...soundingBass.map(notePitch));
      if (notePitch(chord) - bassCeiling >= 7) continue;
      let candidate = notePitch(chord);
      while (candidate - bassCeiling < 7) candidate += 12;
      if (
        candidate <= chordWindow.max
        && candidate >= chordWindow.min
        && !overlapsSamePitch(chordTrack.notes, chord, candidate)
      ) {
        chord.pitch = candidate;
        chord.registerIntegrityRepair = "bass-chord-separation";
        corrections += 1;
        separationCorrections += 1;
        correctionsByTrack.chords = (correctionsByTrack.chords ?? 0) + 1;
      }
    }
    chordTrack.notes.sort((left, right) => finite(left.start) - finite(right.start) || notePitch(left) - notePitch(right));
  }

  const after = analyzeRoleRegisters(cloned);
  return Object.freeze({
    tracks: cloned,
    report: Object.freeze({
      version: 1,
      status: after.hardViolations === 0 ? "clean" : "best-available",
      corrections,
      separationCorrections,
      correctionsByTrack: Object.freeze({ ...correctionsByTrack }),
      before,
      after,
      pitchClassesPreserved: true,
    }),
  });
}
