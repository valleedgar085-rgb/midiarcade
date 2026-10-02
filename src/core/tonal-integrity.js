function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function mod(value, divisor = 12) {
  return ((Math.round(finite(value)) % divisor) + divisor) % divisor;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function scalePitchClasses(meta = {}) {
  const tonic = mod(meta.keyPc, 12);
  const intervals = Array.isArray(meta.scaleIntervals) ? meta.scaleIntervals : [];
  if (!intervals.length) return new Set(Array.from({ length: 12 }, (_, index) => index));
  return new Set(intervals.map((interval) => mod(tonic + interval, 12)));
}

function harmonyAt(harmony = [], beat = 0) {
  let result = harmony[0] ?? null;
  for (const event of harmony) {
    const start = finite(event?.start);
    const duration = Math.max(0, finite(event?.duration));
    if (start <= beat + 1e-6) result = event;
    if (beat >= start - 1e-6 && beat < start + duration - 1e-6) return event;
  }
  return result;
}

function notePitch(note) {
  return Math.max(0, Math.min(127, Math.round(finite(note?.pitch, 60))));
}

function circularDistance(left, right) {
  const raw = Math.abs(mod(left, 12) - mod(right, 12));
  return Math.min(raw, 12 - raw);
}

function rawChordPitchClasses(chord) {
  return new Set((chord?.tones ?? []).map((tone) => mod(tone, 12)));
}

function chordPitchClasses(chord, scaleClasses) {
  return new Set([...rawChordPitchClasses(chord)]
    .filter((pitchClass) => !scaleClasses?.size || scaleClasses.has(pitchClass)));
}

export const TONAL_LICENSE_TYPES = Object.freeze([
  "chromaticApproach",
  "borrowedChordTone",
  "modalInterchangeTone",
  "secondaryDominantTone",
  "alteredDominantTone",
  "blueNote",
]);

function tonalLicenseType(note) {
  const value = String(note?.tonalLicense ?? note?.harmonicRole ?? "").trim();
  return TONAL_LICENSE_TYPES.includes(value) ? value : null;
}

function shortStepResolution(note, nextNote, scaleClasses) {
  if (!nextNote) return false;
  const start = finite(note?.start);
  const nextStart = finite(nextNote?.start, Infinity);
  const duration = Math.max(0.02, finite(note?.duration, 0.25));
  if (duration > 0.6 || nextStart <= start || nextStart - start > 1) return false;
  const motion = Math.abs(notePitch(nextNote) - notePitch(note));
  return motion === 1 && scaleClasses.has(mod(notePitch(nextNote), 12));
}

export function evaluateTonalLicense(note, nextNote, chord, meta = {}) {
  const type = tonalLicenseType(note);
  if (!type) return Object.freeze({ valid: false, type: null, reason: "unlicensed" });

  const scaleClasses = scalePitchClasses(meta);
  const pitchClass = mod(notePitch(note), 12);
  if (scaleClasses.has(pitchClass)) {
    return Object.freeze({ valid: false, type, reason: "already-scale-safe" });
  }

  const rawChordClasses = rawChordPitchClasses(chord);
  if (type === "borrowedChordTone" || type === "modalInterchangeTone") {
    const backedByChord = Boolean(
      chord?.borrowed === true
      || chord?.modalInterchange === true
      || chord?.harmonicLicense === "modalInterchange"
    );
    return Object.freeze({
      valid: backedByChord && rawChordClasses.has(pitchClass),
      type,
      reason: backedByChord && rawChordClasses.has(pitchClass) ? "borrowed-chord-evidence" : "missing-borrowed-chord-evidence",
    });
  }

  if (type === "secondaryDominantTone") {
    const backedByChord = Boolean(
      chord?.secondaryDominant === true
      || chord?.harmonicLicense === "secondaryDominant"
    );
    return Object.freeze({
      valid: backedByChord && rawChordClasses.has(pitchClass),
      type,
      reason: backedByChord && rawChordClasses.has(pitchClass) ? "secondary-dominant-evidence" : "missing-secondary-dominant-evidence",
    });
  }

  if (type === "alteredDominantTone") {
    const backedByChord = Boolean(
      chord?.altered === true
      || chord?.harmonicLicense === "alteredDominant"
    );
    return Object.freeze({
      valid: backedByChord && rawChordClasses.has(pitchClass),
      type,
      reason: backedByChord && rawChordClasses.has(pitchClass) ? "altered-dominant-evidence" : "missing-altered-dominant-evidence",
    });
  }

  if (type === "chromaticApproach" || type === "blueNote") {
    const resolves = shortStepResolution(note, nextNote, scaleClasses);
    const strongBeatSafe = !isStrongBeat(note) || finite(note?.duration, 0.25) <= 0.35;
    return Object.freeze({
      valid: resolves && strongBeatSafe,
      type,
      reason: resolves && strongBeatSafe ? "short-step-resolution" : "missing-safe-resolution",
    });
  }

  return Object.freeze({ valid: false, type, reason: "unsupported-license" });
}

function nearestPitchForClasses(sourcePitch, classes, { maxDistance = 12, avoidCandidate = null } = {}) {
  const source = notePitch({ pitch: sourcePitch });
  const candidates = [];
  for (let delta = -maxDistance; delta <= maxDistance; delta += 1) {
    const candidate = source + delta;
    if (candidate < 0 || candidate > 127 || !classes.has(mod(candidate, 12))) continue;
    if (typeof avoidCandidate === "function" && avoidCandidate(candidate)) continue;
    candidates.push({ pitch: candidate, distance: Math.abs(delta) });
  }
  candidates.sort((left, right) => left.distance - right.distance || left.pitch - right.pitch);
  return candidates[0] ?? { pitch: source, distance: Infinity };
}

function createsSamePitchOverlap(notes, currentNote, candidatePitch) {
  const start = finite(currentNote?.start);
  const end = start + Math.max(0.02, finite(currentNote?.duration, 0.25));
  return (notes ?? []).some((other) => {
    if (other === currentNote || notePitch(other) !== candidatePitch) return false;
    const otherStart = finite(other?.start);
    const otherEnd = otherStart + Math.max(0.02, finite(other?.duration, 0.25));
    return start < otherEnd - 1e-6 && otherStart < end - 1e-6;
  });
}

function isStrongBeat(note) {
  const start = finite(note?.start);
  return Math.abs(start - Math.round(start)) <= 0.055;
}

function isLongColorTone(note) {
  return finite(note?.duration, 0.25) >= 0.72;
}

function protectedStructuralTension(note) {
  return Boolean(
    note?.ensembleCadenceRole
    || note?.resolutionRole
    || note?.transitionRole
    || note?.transitionFeature
    || note?.transitionHandoffRole
    || note?.motifHandoffRole
    || note?.finalAssemblyRole
    || finite(note?.plannedTension, 0) >= 0.72
  );
}

function protectedTension(note) {
  return Boolean(note?.phraseAnchor || protectedStructuralTension(note));
}

function sectionForBeat(structure = [], beat = 0) {
  return structure.find((section) => (
    beat >= finite(section?.startBeat) - 1e-6
    && beat < finite(section?.endBeat, Infinity) - 1e-6
  )) ?? null;
}

function tonalRiskFor(note, chord, scaleClasses) {
  const pitchClass = mod(notePitch(note), 12);
  const chordClasses = chordPitchClasses(chord, scaleClasses);
  if (!chordClasses.size || chordClasses.has(pitchClass)) {
    return { risky: false, chordClasses, nearestDistance: 0 };
  }
  const nearestDistance = Math.min(...[...chordClasses].map((candidate) => circularDistance(pitchClass, candidate)));
  return {
    risky: nearestDistance === 1 && (isStrongBeat(note) || isLongColorTone(note)) && !protectedTension(note),
    chordClasses,
    nearestDistance,
  };
}

function weightedTonicScores(tracks = [], harmony = [], structure = []) {
  const scores = Array.from({ length: 12 }, () => 0);
  for (const event of harmony) {
    const root = mod(event?.rootPc ?? event?.root ?? event?.tones?.[0] ?? 0, 12);
    scores[root] += Math.max(0.25, finite(event?.duration, 1)) * 1.7;
  }

  const melodic = tracks
    .filter((track) => ["melody", "counterpoint", "bass"].includes(String(track?.id)))
    .flatMap((track) => (track?.notes ?? []).map((note) => ({ note, trackId: track.id })));
  for (const section of structure) {
    const end = finite(section?.endBeat);
    const landing = melodic
      .filter(({ note }) => finite(note?.start) < end - 0.01 && finite(note?.start) >= end - 2)
      .sort((left, right) => finite(left.note?.start) - finite(right.note?.start))
      .at(-1);
    if (landing) {
      const weight = landing.trackId === "melody" ? 3.2 : landing.trackId === "bass" ? 2.2 : 1.6;
      scores[mod(notePitch(landing.note), 12)] += weight;
    }
  }

  const finalMelody = tracks.find((track) => track?.id === "melody")?.notes?.at(-1);
  if (finalMelody) scores[mod(notePitch(finalMelody), 12)] += 5;
  const finalHarmony = harmony.at(-1);
  if (finalHarmony) scores[mod(finalHarmony?.rootPc ?? finalHarmony?.root ?? finalHarmony?.tones?.[0] ?? 0, 12)] += 5;
  return scores;
}

export function analyzeTonalIntegrity(tracks = [], harmony = [], meta = {}, structure = []) {
  const scaleClasses = scalePitchClasses(meta);
  const pitchedEntries = tracks
    .filter((track) => track?.id !== "drums")
    .flatMap((track) => {
      const ordered = [...(track?.notes ?? [])].sort((left, right) => (
        finite(left?.start) - finite(right?.start) || notePitch(left) - notePitch(right)
      ));
      return ordered.map((note, index) => ({
        note,
        nextNote: ordered[index + 1] ?? null,
        trackId: track?.id,
      }));
    });

  let literalScaleSafeCount = 0;
  let licensedColorNotes = 0;
  let unsafeScaleNotes = 0;
  for (const entry of pitchedEntries) {
    const pitchClass = mod(notePitch(entry.note), 12);
    if (scaleClasses.has(pitchClass)) {
      literalScaleSafeCount += 1;
      continue;
    }
    const chord = harmonyAt(harmony, finite(entry.note?.start));
    const license = evaluateTonalLicense(entry.note, entry.nextNote, chord, meta);
    if (license.valid) licensedColorNotes += 1;
    else unsafeScaleNotes += 1;
  }

  const literalScaleFit = pitchedEntries.length ? literalScaleSafeCount / pitchedEntries.length : 1;
  const scaleFit = pitchedEntries.length
    ? (literalScaleSafeCount + licensedColorNotes) / pitchedEntries.length
    : 1;

  let contextualNotes = 0;
  let chordToneNotes = 0;
  let harshStrongNotes = 0;
  for (const track of tracks.filter((candidate) => ["melody", "counterpoint"].includes(String(candidate?.id)))) {
    const ordered = [...(track?.notes ?? [])].sort((left, right) => (
      finite(left?.start) - finite(right?.start) || notePitch(left) - notePitch(right)
    ));
    for (let index = 0; index < ordered.length; index += 1) {
      const note = ordered[index];
      const nextNote = ordered[index + 1] ?? null;
      const chord = harmonyAt(harmony, finite(note?.start));
      const chordClasses = chordPitchClasses(chord, scaleClasses);
      if (!chordClasses.size || !(isStrongBeat(note) || isLongColorTone(note))) continue;
      contextualNotes += 1;
      const pitchClass = mod(notePitch(note), 12);
      const license = evaluateTonalLicense(note, nextNote, chord, meta);
      const rawChordClasses = rawChordPitchClasses(chord);
      if (chordClasses.has(pitchClass) || license.valid && rawChordClasses.has(pitchClass)) {
        chordToneNotes += 1;
      } else if (!license.valid && tonalRiskFor(note, chord, scaleClasses).risky) {
        harshStrongNotes += 1;
      }
    }
  }

  const tonicScores = weightedTonicScores(tracks, harmony, structure);
  const detectedTonicPc = tonicScores.indexOf(Math.max(...tonicScores));
  const selectedKeyPc = mod(meta?.keyPc, 12);
  const maxScore = Math.max(1e-9, ...tonicScores);
  const selectedScore = tonicScores[selectedKeyPc] ?? 0;

  return Object.freeze({
    version: 2,
    selectedKeyPc,
    detectedTonicPc,
    tonicConfidence: round(maxScore / Math.max(1e-9, tonicScores.reduce((sum, value) => sum + value, 0))),
    selectedTonicAlignment: round(selectedScore / maxScore),
    scaleFit: round(scaleFit),
    literalScaleFit: round(literalScaleFit),
    licensedColorNotes,
    unsafeScaleNotes,
    strongChordFit: round(contextualNotes ? chordToneNotes / contextualNotes : 1),
    contextualNotes,
    harshStrongNotes,
  });
}

export function refineTonalIntegrity(tracks = [], harmony = [], meta = {}, structure = []) {
  const scaleClasses = scalePitchClasses(meta);
  const clonedTracks = tracks.map((track) => ({
    ...track,
    notes: (track?.notes ?? []).map((note) => ({ ...note })),
  }));
  const before = analyzeTonalIntegrity(clonedTracks, harmony, meta, structure);
  let scaleCorrections = 0;
  let chordCorrections = 0;
  let licensedPreserved = 0;
  const correctionsByTrack = {};
  const sectionCorrections = new Map();

  for (const track of clonedTracks) {
    if (track.id === "drums") continue;
    let trackCorrections = 0;
    const ordered = [...(track.notes ?? [])].sort((left, right) => (
      finite(left?.start) - finite(right?.start) || notePitch(left) - notePitch(right)
    ));
    for (let index = 0; index < ordered.length; index += 1) {
      const note = ordered[index];
      const nextNote = ordered[index + 1] ?? null;
      const originalPitch = notePitch(note);
      const chord = harmonyAt(harmony, finite(note?.start));
      const license = evaluateTonalLicense(note, nextNote, chord, meta);

      if (!scaleClasses.has(mod(originalPitch, 12))) {
        if (license.valid) {
          note.tonalIntegrityLicense = license.type;
          licensedPreserved += 1;
        } else {
          const corrected = nearestPitchForClasses(originalPitch, scaleClasses, {
            maxDistance: 12,
            avoidCandidate: (candidate) => createsSamePitchOverlap(track.notes, note, candidate),
          });
          if (corrected.pitch !== originalPitch) {
            note.pitch = corrected.pitch;
            note.tonalIntegrityRepair = "scale-snap";
            scaleCorrections += 1;
            trackCorrections += 1;
          }
        }
      }

      if (!["melody", "counterpoint"].includes(String(track.id)) || license.valid) continue;
      const risk = tonalRiskFor(note, chord, scaleClasses);
      const genreStrongAnchor = ["hipHop", "synthwave"].includes(String(meta?.genre))
        && isStrongBeat(note)
        && !protectedStructuralTension(note)
        && !risk.chordClasses.has(mod(notePitch(note), 12))
        && risk.nearestDistance <= 2;
      if (!risk.risky && !genreStrongAnchor) continue;

      const section = sectionForBeat(structure, finite(note?.start));
      const sectionKey = `${track.id}:${section?.id ?? "song"}`;
      const used = sectionCorrections.get(sectionKey) ?? 0;
      if (used >= 2) continue;

      const candidate = nearestPitchForClasses(notePitch(note), risk.chordClasses, {
        maxDistance: 2,
        avoidCandidate: (pitch) => createsSamePitchOverlap(track.notes, note, pitch),
      });
      if (!Number.isFinite(candidate.distance) || candidate.distance > 2 || candidate.pitch === notePitch(note)) continue;

      note.pitch = candidate.pitch;
      note.tonalIntegrityRepair = "strong-chord-resolution";
      chordCorrections += 1;
      trackCorrections += 1;
      sectionCorrections.set(sectionKey, used + 1);
    }
    correctionsByTrack[track.id] = trackCorrections;
  }

  const after = analyzeTonalIntegrity(clonedTracks, harmony, meta, structure);
  return Object.freeze({
    tracks: clonedTracks,
    report: Object.freeze({
      version: 2,
      status: after.scaleFit >= 0.999999 && after.harshStrongNotes === 0 ? "clean" : "best-available",
      scaleCorrections,
      chordCorrections,
      licensedPreserved,
      correctionsByTrack: Object.freeze({ ...correctionsByTrack }),
      before,
      after,
    }),
  });
}
