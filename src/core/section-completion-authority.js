export const SECTION_COMPLETION_AUTHORITY_VERSION = 1;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, places = 4) {
  const power = 10 ** places;
  return Math.round((value + Number.EPSILON) * power) / power;
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function cloneTracks(sourceTracks = []) {
  return sourceTracks.map((track) => ({
    ...track,
    notes: (track?.notes ?? []).map((note) => ({ ...note })),
  }));
}

function sectionRange(section, beatsPerBar = 4) {
  const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const bars = Math.max(1, finite(section?.bars, 1));
  const endBeat = Math.max(startBeat + 0.25, finite(section?.endBeat, startBeat + bars * beatsPerBar));
  return { startBeat, endBeat, bars };
}

function transitionFor(songBlueprint, fromSectionId, toSectionId) {
  return (songBlueprint?.transitions ?? []).find((transition) => (
    String(transition?.fromSectionId) === String(fromSectionId)
    && String(transition?.toSectionId) === String(toSectionId)
  )) ?? null;
}

function planFor(songBlueprint, sectionId) {
  return (songBlueprint?.sectionPlans ?? songBlueprint?.sections ?? []).find((plan) => (
    String(plan?.sectionId ?? plan?.id) === String(sectionId)
  )) ?? null;
}

function harmonyGoalAt(harmony = [], boundary = 0, startBeat = 0) {
  const candidates = harmony.filter((event) => (
    finite(event?.start, -1) < boundary - 1e-6
    && finite(event?.start, -1) + Math.max(0.01, finite(event?.duration, 0.25)) > startBeat + 1e-6
  ));
  return candidates.at(-1) ?? null;
}

function nearestPitchClass(pitch, pitchClasses, minimum, maximum) {
  if (!Number.isFinite(Number(pitch)) || !pitchClasses?.length) return pitch;
  let selected = pitch;
  let bestDistance = Infinity;
  for (const pitchClass of pitchClasses) {
    for (let candidate = mod(Math.round(pitchClass), 12); candidate <= 127; candidate += 12) {
      if (candidate < minimum || candidate > maximum) continue;
      const distance = Math.abs(candidate - pitch);
      if (distance < bestDistance) {
        selected = candidate;
        bestDistance = distance;
      }
    }
  }
  return selected;
}

function notesForSection(track, section, beatsPerBar = 4) {
  const range = sectionRange(section, beatsPerBar);
  return (track?.notes ?? []).filter((note) => (
    finite(note?.start, -1) >= range.startBeat - 1e-6
    && finite(note?.start, -1) < range.endBeat - 1e-6
  ));
}

function lastSectionNote(track, section, beatsPerBar = 4) {
  return notesForSection(track, section, beatsPerBar)
    .slice()
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch))
    .at(-1) ?? null;
}

function noteEnd(note) {
  return finite(note?.start) + Math.max(0.02, finite(note?.duration, 0.25));
}

function firstArrival(track, boundary, window = 0.24, predicate = null) {
  return (track?.notes ?? [])
    .filter((note) => (
      finite(note?.start, -1) >= boundary - 0.04
      && finite(note?.start, -1) <= boundary + window
      && (!predicate || predicate(note))
    ))
    .sort((left, right) => Math.abs(finite(left.start) - boundary) - Math.abs(finite(right.start) - boundary))
    [0] ?? null;
}

export function createSectionCompletionContracts({
  structure = [],
  songBlueprint = null,
  beatsPerBar = 4,
} = {}) {
  const contracts = [];
  for (let index = 0; index < structure.length; index += 1) {
    const from = structure[index];
    const to = structure[index + 1] ?? null;
    const range = sectionRange(from, beatsPerBar);
    const plan = planFor(songBlueprint, from?.id);
    const transition = to ? transitionFor(songBlueprint, from?.id, to?.id) : null;
    const cadence = String(plan?.cadence ?? from?.intent?.cadence ?? (to ? "open" : "resolve"));
    const transitionType = String(transition?.type ?? (to ? "continue" : "final"));
    const transitionStrength = clamp(finite(transition?.strength, to ? 0.55 : 1));
    const pickupBeats = to
      ? clamp(finite(transition?.pickupBeats, 0.5), 0.25, 2)
      : 0;
    const payoffArrival = Boolean(to && ["chorus", "drop", "hook"].includes(String(to?.name ?? "")));
    const resetArrival = Boolean(to && ["breakdown", "bridge"].includes(String(to?.name ?? "")));
    const outroArrival = Boolean(to && String(to?.name ?? "") === "outro");
    const breathBeats = to && (
      transitionType === "drop-out"
      || payoffArrival && transitionStrength >= 0.62
    )
      ? clamp(Math.min(pickupBeats, beatsPerBar * 0.25), 0.25, 0.75)
      : 0;

    contracts.push({
      version: SECTION_COMPLETION_AUTHORITY_VERSION,
      id: to ? `section-completion:${from?.id}->${to?.id}` : `section-completion:${from?.id}->END`,
      fromSectionId: from?.id ?? null,
      toSectionId: to?.id ?? null,
      boundaryBeat: round(range.endBeat),
      cadence,
      transitionType,
      transitionStrength: round(transitionStrength),
      pickupBeats: round(pickupBeats),
      breathBeats: round(breathBeats),
      exitMode: !to
        ? "final"
        : cadence === "resolve"
          ? "resolve"
          : cadence === "lift"
            ? "launch"
            : cadence === "suspend"
              ? "suspend"
              : "continue",
      arrivalMode: !to
        ? "stop"
        : payoffArrival
          ? "impact"
          : resetArrival
            ? "reset"
            : outroArrival
              ? "settle"
              : transitionType === "drop-out"
                ? "re-entry"
                : "continue",
      requiresSeamClear: !to || transitionStrength >= 0.68 || breathBeats > 0,
      requiresCadenceLanding: !to || cadence === "resolve",
      requiresArrivalAnchor: Boolean(to && transitionType !== "drop-out"),
      isFinal: !to,
    });
  }
  return contracts;
}

function retuneBoundaryLanding(trackId, note, goal, contract) {
  if (!note || !goal || !contract.requiresCadenceLanding) return false;
  const rootPc = Number.isFinite(Number(goal?.rootPc))
    ? mod(Math.round(goal.rootPc), 12)
    : Number.isFinite(Number(goal?.degreePitchClass))
      ? mod(Math.round(goal.degreePitchClass), 12)
      : null;
  const tones = [...new Set((goal?.tones ?? []).map((tone) => mod(Math.round(tone), 12)))];
  if (rootPc != null && !tones.includes(rootPc)) tones.unshift(rootPc);
  if (!tones.length) return false;

  const bounds = trackId === "bass"
    ? [28, 60]
    : trackId === "melody"
      ? [52, 92]
      : [45, 96];
  const targetClasses = trackId === "bass" && rootPc != null ? [rootPc] : tones;
  const target = nearestPitchClass(note.pitch, targetClasses, bounds[0], bounds[1]);
  if (target === note.pitch) return false;
  note.pitch = target;
  note.sectionCompletionRetuned = true;
  return true;
}

function shapeLandingDuration(note, boundary, maximumHold = 1) {
  if (!note) return false;
  const desiredEnd = boundary - 0.025;
  const currentEnd = noteEnd(note);
  let nextDuration = finite(note.duration, 0.25);
  if (currentEnd > boundary - 0.005) {
    nextDuration = Math.max(0.04, desiredEnd - finite(note.start));
  } else if (desiredEnd - currentEnd <= 0.55 && desiredEnd > currentEnd + 0.04) {
    nextDuration = Math.min(
      maximumHold,
      Math.max(nextDuration, desiredEnd - finite(note.start)),
    );
  }
  nextDuration = Math.max(0.04, nextDuration);
  if (Math.abs(nextDuration - finite(note.duration, 0.25)) <= 0.001) return false;
  note.duration = round(nextDuration);
  return true;
}

function clearOutgoingCrossings(track, boundary, seamBeat, contract) {
  let repairs = 0;
  for (const note of track?.notes ?? []) {
    const start = finite(note?.start, -1);
    if (start < seamBeat - 1e-6 && noteEnd(note) > seamBeat + 1e-6) {
      note.duration = round(Math.max(0.03, seamBeat - start));
      note.sectionCompletionRole = contract.isFinal ? "final-seam-clear" : "boundary-seam-clear";
      repairs += 1;
    }
  }
  return repairs;
}

function clearBreathWindow(track, breathStart, boundary, contract) {
  if (!(contract.breathBeats > 0) || !track) return { removed: 0, trimmed: 0 };
  let removed = 0;
  let trimmed = 0;
  track.notes = (track.notes ?? []).filter((note) => {
    const start = finite(note?.start, -1);
    if (start >= breathStart - 1e-6 && start < boundary - 0.04) {
      removed += 1;
      return false;
    }
    if (start < breathStart - 1e-6 && noteEnd(note) > breathStart + 1e-6) {
      note.duration = round(Math.max(0.03, breathStart - start));
      note.sectionCompletionRole = "pre-payoff-breath";
      trimmed += 1;
    }
    return true;
  });
  return { removed, trimmed };
}

export function applySectionCompletionAuthority(
  sourceTracks = [],
  structure = [],
  harmony = [],
  songBlueprint = null,
  { beatsPerBar = 4 } = {},
) {
  const tracks = cloneTracks(sourceTracks);
  const byId = new Map(tracks.map((track) => [String(track.id), track]));
  const sectionById = new Map(structure.map((section) => [String(section?.id), section]));
  const contracts = createSectionCompletionContracts({ structure, songBlueprint, beatsPerBar });

  let notesRetuned = 0;
  let durationsShaped = 0;
  let seamCrossingsCleared = 0;
  let breathNotesRemoved = 0;
  let breathNotesTrimmed = 0;
  let arrivalsAligned = 0;

  for (const contract of contracts) {
    const from = sectionById.get(String(contract.fromSectionId));
    const to = contract.toSectionId == null ? null : sectionById.get(String(contract.toSectionId));
    if (!from) continue;
    const fromRange = sectionRange(from, beatsPerBar);
    const goal = harmonyGoalAt(harmony, contract.boundaryBeat, fromRange.startBeat);

    for (const trackId of ["bass", "melody"]) {
      const track = byId.get(trackId);
      const landing = lastSectionNote(track, from, beatsPerBar);
      if (!landing) continue;
      if (retuneBoundaryLanding(trackId, landing, goal, contract)) notesRetuned += 1;
      if (shapeLandingDuration(landing, contract.boundaryBeat, trackId === "bass" ? 1.25 : 1)) {
        durationsShaped += 1;
      }
      landing.sectionCompletionRole = contract.isFinal
        ? `final-${trackId}-landing`
        : `${contract.exitMode}-${trackId}-landing`;
      landing.sectionCompletionId = contract.id;
    }

    const seamBeat = contract.requiresSeamClear
      ? contract.boundaryBeat - 0.025
      : contract.boundaryBeat + 0.015;
    for (const trackId of ["counterpoint", "chords", "pad"]) {
      seamCrossingsCleared += clearOutgoingCrossings(
        byId.get(trackId),
        contract.boundaryBeat,
        seamBeat,
        contract,
      );
    }

    if (contract.breathBeats > 0) {
      const breathStart = contract.boundaryBeat - contract.breathBeats;
      for (const trackId of ["counterpoint", "pad"]) {
        const result = clearBreathWindow(byId.get(trackId), breathStart, contract.boundaryBeat, contract);
        breathNotesRemoved += result.removed;
        breathNotesTrimmed += result.trimmed;
      }
      if (contract.transitionStrength >= 0.78) {
        const result = clearBreathWindow(byId.get("chords"), breathStart, contract.boundaryBeat, contract);
        breathNotesRemoved += result.removed;
        breathNotesTrimmed += result.trimmed;
      }
    }

    if (to && contract.requiresArrivalAnchor) {
      const bassArrival = firstArrival(byId.get("bass"), contract.boundaryBeat, 0.24);
      const chordArrival = firstArrival(byId.get("chords"), contract.boundaryBeat, 0.24);
      const kickArrival = firstArrival(
        byId.get("drums"),
        contract.boundaryBeat,
        0.18,
        (note) => [35, 36].includes(Math.round(finite(note?.pitch, -1))),
      );
      for (const [role, arrival] of [
        ["bass", bassArrival],
        ["chords", chordArrival],
        ["kick", kickArrival],
      ]) {
        if (!arrival) continue;
        if (Math.abs(finite(arrival.start) - contract.boundaryBeat) <= 0.24) {
          if (Math.abs(finite(arrival.start) - contract.boundaryBeat) > 0.01) {
            arrival.start = round(contract.boundaryBeat);
            arrivalsAligned += 1;
          }
          arrival.sectionCompletionRole = `${contract.arrivalMode}-${role}-arrival`;
          arrival.sectionCompletionId = contract.id;
        }
      }
    }

    if (contract.isFinal) {
      for (const trackId of ["chords", "pad"]) {
        const finalNote = lastSectionNote(byId.get(trackId), from, beatsPerBar);
        if (!finalNote) continue;
        if (shapeLandingDuration(finalNote, contract.boundaryBeat, 1.35)) durationsShaped += 1;
        finalNote.sectionCompletionRole = "final-harmonic-release";
        finalNote.sectionCompletionId = contract.id;
      }
    }
  }

  for (const track of tracks) {
    track.notes.sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  }

  const report = evaluateSectionCompletionAuthority({
    tracks,
    structure,
    harmony,
    songBlueprint,
    meta: { beatsPerBar },
  });

  return {
    tracks,
    report: {
      ...report,
      phase: 77,
      status: report.passed ? "complete" : "needs-attention",
      notesRetuned,
      durationsShaped,
      seamCrossingsCleared,
      breathNotesRemoved,
      breathNotesTrimmed,
      arrivalsAligned,
    },
  };
}

export function evaluateSectionCompletionAuthority(song) {
  const structure = Array.isArray(song?.structure) ? song.structure : [];
  const harmony = Array.isArray(song?.harmony) ? song.harmony : [];
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const contracts = createSectionCompletionContracts({
    structure,
    songBlueprint: song?.songBlueprint,
    beatsPerBar,
  });
  const byId = new Map((song?.tracks ?? []).map((track) => [String(track.id), track]));
  const sectionById = new Map(structure.map((section) => [String(section?.id), section]));
  const boundaries = [];

  for (const contract of contracts) {
    const from = sectionById.get(String(contract.fromSectionId));
    if (!from) continue;
    const fromRange = sectionRange(from, beatsPerBar);
    const goal = harmonyGoalAt(harmony, contract.boundaryBeat, fromRange.startBeat);
    const rootPc = Number.isFinite(Number(goal?.rootPc)) ? mod(Math.round(goal.rootPc), 12) : null;
    const goalTones = new Set((goal?.tones ?? []).map((tone) => mod(Math.round(tone), 12)));
    if (rootPc != null) goalTones.add(rootPc);

    const bassLanding = lastSectionNote(byId.get("bass"), from, beatsPerBar);
    const melodyLanding = lastSectionNote(byId.get("melody"), from, beatsPerBar);
    const bassPitchFit = !contract.requiresCadenceLanding || !bassLanding || rootPc == null
      ? 0.8
      : Number(mod(Math.round(finite(bassLanding.pitch)), 12) === rootPc);
    const melodyPitchFit = !contract.requiresCadenceLanding || !melodyLanding || !goalTones.size
      ? 0.8
      : Number(goalTones.has(mod(Math.round(finite(melodyLanding.pitch)), 12)));

    const endDistances = [bassLanding, melodyLanding]
      .filter(Boolean)
      .map((note) => Math.abs((contract.boundaryBeat - 0.025) - noteEnd(note)));
    const endingFit = endDistances.length
      ? endDistances.reduce((sum, distance) => sum + clamp(1 - distance / 0.7), 0) / endDistances.length
      : 0.65;

    const seamTracks = ["counterpoint", "chords", "pad"];
    let crossingCount = 0;
    let seamCandidates = 0;
    for (const trackId of seamTracks) {
      for (const note of notesForSection(byId.get(trackId), from, beatsPerBar)) {
        if (finite(note.start) >= contract.boundaryBeat - 1.2) seamCandidates += 1;
        if (finite(note.start) < contract.boundaryBeat - 0.025 && noteEnd(note) > contract.boundaryBeat + 0.02) {
          crossingCount += 1;
        }
      }
    }
    const seamClear = clamp(1 - crossingCount / Math.max(1, seamCandidates));

    let breathFit = 1;
    if (contract.breathBeats > 0) {
      const breathStart = contract.boundaryBeat - contract.breathBeats;
      let supportOnsets = 0;
      for (const trackId of ["counterpoint", "pad", ...(contract.transitionStrength >= 0.78 ? ["chords"] : [])]) {
        supportOnsets += (byId.get(trackId)?.notes ?? []).filter((note) => (
          finite(note.start, -1) >= breathStart - 1e-6
          && finite(note.start, -1) < contract.boundaryBeat - 0.04
        )).length;
      }
      breathFit = clamp(1 - supportOnsets / 3);
    }

    let arrivalFit = 1;
    if (contract.toSectionId != null && contract.requiresArrivalAnchor) {
      const arrivals = [
        firstArrival(byId.get("bass"), contract.boundaryBeat, 0.24),
        firstArrival(byId.get("chords"), contract.boundaryBeat, 0.24),
        firstArrival(
          byId.get("drums"),
          contract.boundaryBeat,
          0.18,
          (note) => [35, 36].includes(Math.round(finite(note?.pitch, -1))),
        ),
      ].filter(Boolean);
      arrivalFit = arrivals.length
        ? arrivals.reduce((sum, note) => sum + clamp(1 - Math.abs(finite(note.start) - contract.boundaryBeat) / 0.24), 0)
          / arrivals.length
        : 0.55;
    }

    const cadenceFit = clamp((bassPitchFit + melodyPitchFit) / 2);
    const score = Math.round(clamp(
      endingFit * 0.24
      + cadenceFit * 0.26
      + seamClear * 0.2
      + breathFit * 0.12
      + arrivalFit * 0.18,
      0,
      1,
    ) * 100);

    boundaries.push({
      id: contract.id,
      fromSectionId: contract.fromSectionId,
      toSectionId: contract.toSectionId,
      exitMode: contract.exitMode,
      arrivalMode: contract.arrivalMode,
      cadence: contract.cadence,
      transitionType: contract.transitionType,
      score,
      endingFit: round(endingFit),
      cadenceFit: round(cadenceFit),
      seamClear: round(seamClear),
      breathFit: round(breathFit),
      arrivalFit: round(arrivalFit),
    });
  }

  const score = boundaries.length
    ? Math.round(boundaries.reduce((sum, boundary) => sum + boundary.score, 0) / boundaries.length)
    : 75;
  const weakestBoundary = [...boundaries].sort((left, right) => left.score - right.score)[0] ?? null;
  const finalBoundary = boundaries.find((boundary) => boundary.toSectionId == null) ?? null;
  const passed = score >= 76
    && finite(weakestBoundary?.score, 76) >= 58
    && finite(finalBoundary?.endingFit, 0.75) >= 0.6
    && finite(finalBoundary?.cadenceFit, 0.75) >= 0.6;

  return {
    version: SECTION_COMPLETION_AUTHORITY_VERSION,
    authority: "section-completion-v1.1",
    passed,
    reason: passed ? "sections-land-and-hand-off" : "section-boundary-needs-attention",
    score,
    boundaryCount: boundaries.length,
    weakestBoundary,
    finalBoundary,
    boundaries,
  };
}
