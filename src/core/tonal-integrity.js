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

function chordPitchClasses(chord, scaleClasses) {
  return new Set((chord?.tones ?? [])
    .map((tone) => mod(tone, 12))
    .filter((pitchClass) => !scaleClasses?.size || scaleClasses.has(pitchClass)));
}

function nearestPitchForClasses(sourcePitch, classes, { maxDistance = 12 } = {}) {
  const source = notePitch({ pitch: sourcePitch });
  let best = source;
  let bestDistance = Infinity;
  for (let delta = -maxDistance; delta <= maxDistance; delta += 1) {
    const candidate = source + delta;
    if (candidate < 0 || candidate > 127 || !classes.has(mod(candidate, 12))) continue;
    const distance = Math.abs(delta);
    if (distance < bestDistance || (distance === bestDistance && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return { pitch: best, distance: bestDistance };
}

function isStrongBeat(note) {
  const start = finite(note?.start);
  return Math.abs(start - Math.round(start)) <= 0.055;
}

function isLongColorTone(note) {
  return finite(note?.duration, 0.25) >= 0.72;
}

function protectedTension(note) {
  return Boolean(
    note?.ensembleCadenceRole
    || note?.resolutionRole
    || note?.transitionRole
    || note?.transitionFeature
    || note?.transitionHandoffRole
    || note?.phraseAnchor
    || note?.motifHandoffRole
    || note?.finalAssemblyRole
    || finite(note?.plannedTension, 0) >= 0.72
  );
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
  const pitched = tracks
    .filter((track) => track?.id !== "drums")
    .flatMap((track) => track?.notes ?? []);
  const scaleSafeCount = pitched.filter((note) => scaleClasses.has(mod(notePitch(note), 12))).length;
  const scaleFit = pitched.length ? scaleSafeCount / pitched.length : 1;

  let contextualNotes = 0;
  let chordToneNotes = 0;
  let harshStrongNotes = 0;
  for (const track of tracks.filter((candidate) => ["melody", "counterpoint"].includes(String(candidate?.id)))) {
    for (const note of track?.notes ?? []) {
      const chord = harmonyAt(harmony, finite(note?.start));
      const chordClasses = chordPitchClasses(chord, scaleClasses);
      if (!chordClasses.size || !(isStrongBeat(note) || isLongColorTone(note))) continue;
      contextualNotes += 1;
      const pitchClass = mod(notePitch(note), 12);
      if (chordClasses.has(pitchClass)) chordToneNotes += 1;
      else if (tonalRiskFor(note, chord, scaleClasses).risky) harshStrongNotes += 1;
    }
  }

  const tonicScores = weightedTonicScores(tracks, harmony, structure);
  const detectedTonicPc = tonicScores.indexOf(Math.max(...tonicScores));
  const selectedKeyPc = mod(meta?.keyPc, 12);
  const maxScore = Math.max(1e-9, ...tonicScores);
  const selectedScore = tonicScores[selectedKeyPc] ?? 0;

  return Object.freeze({
    version: 1,
    selectedKeyPc,
    detectedTonicPc,
    tonicConfidence: round(maxScore / Math.max(1e-9, tonicScores.reduce((sum, value) => sum + value, 0))),
    selectedTonicAlignment: round(selectedScore / maxScore),
    scaleFit: round(scaleFit),
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
  const correctionsByTrack = {};
  const sectionCorrections = new Map();

  for (const track of clonedTracks) {
    if (track.id === "drums") continue;
    let trackCorrections = 0;
    for (const note of track.notes ?? []) {
      const originalPitch = notePitch(note);
      if (!scaleClasses.has(mod(originalPitch, 12))) {
        const corrected = nearestPitchForClasses(originalPitch, scaleClasses, { maxDistance: 12 });
        if (corrected.pitch !== originalPitch) {
          note.pitch = corrected.pitch;
          note.tonalIntegrityRepair = "scale-snap";
          scaleCorrections += 1;
          trackCorrections += 1;
        }
      }

      if (!["melody", "counterpoint"].includes(String(track.id))) continue;
      const chord = harmonyAt(harmony, finite(note?.start));
      const risk = tonalRiskFor(note, chord, scaleClasses);
      if (!risk.risky) continue;

      const section = sectionForBeat(structure, finite(note?.start));
      const sectionKey = `${track.id}:${section?.id ?? "song"}`;
      const used = sectionCorrections.get(sectionKey) ?? 0;
      if (used >= 2) continue;

      const candidate = nearestPitchForClasses(notePitch(note), risk.chordClasses, { maxDistance: 2 });
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
      version: 1,
      status: after.scaleFit >= 0.999999 && after.harshStrongNotes === 0 ? "clean" : "best-available",
      scaleCorrections,
      chordCorrections,
      correctionsByTrack: Object.freeze({ ...correctionsByTrack }),
      before,
      after,
    }),
  });
}
