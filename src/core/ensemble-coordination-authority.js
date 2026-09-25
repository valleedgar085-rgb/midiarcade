export const ENSEMBLE_RELATIONSHIP_KINDS = Object.freeze([
  "rhythm-foundation",
  "harmonic-support",
  "lead-dialogue",
  "foreground-hierarchy",
  "cadence-team",
]);

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function round(value, places = 4) {
  const power = 10 ** places;
  return Math.round((value + Number.EPSILON) * power) / power;
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function sectionRange(song, section) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const bars = Math.max(1, finite(section?.bars, 1));
  const endBeat = Math.max(startBeat + 0.25, finite(section?.endBeat, startBeat + bars * beatsPerBar));
  return { startBeat, endBeat, beatsPerBar, bars };
}

function notesInRange(track, range) {
  return (track?.notes ?? []).filter((note) => (
    finite(note?.start, -1) >= range.startBeat - 1e-6
    && finite(note?.start, -1) < range.endBeat - 1e-6
  ));
}

function relationshipKinds(coordination) {
  return new Set((coordination?.relationships ?? []).map((relationship) => relationship.kind));
}

function groovePulsesForSection(song, sectionId, lane, beatsPerBar) {
  return (song?.grooveConductor?.bars ?? [])
    .filter((bar) => String(bar?.sectionId ?? "") === String(sectionId ?? ""))
    .flatMap((bar) => (bar?.[lane] ?? []).map((offset) => (
      finite(bar?.bar, 0) * beatsPerBar + finite(offset, 0)
    )));
}

function onsetLaneFit(notes, pulses, tolerance = 0.095, fallback = 0.72) {
  if (!notes.length) return fallback;
  if (!pulses.length) return 0.45;
  const aligned = notes.filter((note) => (
    pulses.some((pulse) => Math.abs(finite(note?.start) - pulse) <= tolerance)
  )).length;
  return clamp(aligned / notes.length);
}

function overlapRatio(leftNotes, rightNotes, tolerance = 0.08) {
  if (!leftNotes.length || !rightNotes.length) return 0;
  const matched = leftNotes.filter((left) => rightNotes.some((right) => (
    Math.abs(finite(left?.start) - finite(right?.start)) <= tolerance
  ))).length;
  return clamp(matched / leftNotes.length);
}

function registerCrowding(leftNotes, rightNotes, semitones = 7, tolerance = 0.16) {
  if (!leftNotes.length || !rightNotes.length) return 0;
  const crowded = leftNotes.filter((left) => rightNotes.some((right) => (
    Math.abs(finite(left?.start) - finite(right?.start)) <= tolerance
    && Math.abs(finite(left?.pitch) - finite(right?.pitch)) <= semitones
  ))).length;
  return clamp(crowded / leftNotes.length);
}

function uniqueOnsets(notes) {
  const values = [];
  for (const note of notes) {
    const start = round(finite(note?.start), 4);
    if (!values.some((value) => Math.abs(value - start) <= 0.015)) values.push(start);
  }
  return values;
}

export function createEnsembleCoordinationContract({
  sectionId,
  featuredTrack = "melody",
  answerTrack = null,
  ensembleRoles = {},
  cadence = "open",
  silenceBudget = 0.13,
} = {}) {
  const foreground = String(featuredTrack || "melody");
  const leadLeader = foreground === "counterpoint" ? "counterpoint" : "melody";
  const requestedAnswer = String(answerTrack ?? "");
  const leadResponder = (
    ["melody", "counterpoint"].includes(requestedAnswer)
    && requestedAnswer !== leadLeader
  )
    ? requestedAnswer
    : leadLeader === "melody" ? "counterpoint" : "melody";
  const supportTracks = ["chords", "pad", "melody", "counterpoint"]
    .filter((trackId) => trackId !== foreground);

  return {
    version: 1,
    authority: "ensemble-coordination-v1",
    sectionId: sectionId ?? null,
    featuredTrack: foreground,
    answerTrack: leadResponder,
    cadence: String(cadence || "open"),
    silenceBudget: round(clamp(finite(silenceBudget, 0.13), 0.05, 0.4)),
    roles: { ...ensembleRoles },
    requiredRelationshipKinds: [...ENSEMBLE_RELATIONSHIP_KINDS],
    relationships: [
      {
        id: `ensemble:${sectionId}:rhythm-foundation`,
        kind: "rhythm-foundation",
        leaders: ["drums"],
        responders: ["bass"],
        authority: "grooveConductor",
        policy: "respond-without-cloning",
        required: true,
      },
      {
        id: `ensemble:${sectionId}:harmonic-support`,
        kind: "harmonic-support",
        leaders: ["drums", "bass"],
        responders: ["chords", "pad"],
        authority: "harmony+grooveConductor",
        policy: "yield-to-foundation",
        required: true,
      },
      {
        id: `ensemble:${sectionId}:lead-dialogue`,
        kind: "lead-dialogue",
        leaders: [leadLeader],
        responders: [leadResponder],
        authority: "motifs+grooveConductor",
        policy: "call-response",
        required: true,
      },
      {
        id: `ensemble:${sectionId}:foreground-hierarchy`,
        kind: "foreground-hierarchy",
        leaders: [foreground],
        responders: supportTracks,
        authority: "producerIntent",
        policy: "support-yields-to-feature",
        required: true,
      },
      {
        id: `ensemble:${sectionId}:cadence-team`,
        kind: "cadence-team",
        leaders: ["melody", "counterpoint", "bass"],
        responders: ["chords", "pad"],
        authority: "harmony",
        policy: "shared-resolution",
        required: true,
      },
    ],
  };
}

export function evaluateEnsembleCoordinationAuthority(song) {
  const sections = Array.isArray(song?.structure) ? song.structure : [];
  const contracts = song?.generationInterlock?.sectionContracts ?? [];
  const tracks = new Map((song?.tracks ?? []).map((track) => [String(track.id), track]));

  if (!sections.length || !contracts.length) {
    return {
      version: 2,
      passed: false,
      reason: "missing-ensemble-contracts",
      score: 55,
      metrics: {
        contractCoverage: 0,
        rhythmFoundation: 0.55,
        leadDialogue: 0.55,
        harmonicSupport: 0.55,
        roleHierarchy: 0.55,
        cadenceTeam: 0.55,
        collisionControl: 0.55,
      },
      sections: [],
    };
  }

  const sectionById = new Map(sections.map((section) => [String(section.id), section]));
  const sectionReports = [];

  for (const contract of contracts) {
    const section = sectionById.get(String(contract?.sectionId ?? ""));
    if (!section) continue;
    const range = sectionRange(song, section);
    const coordination = contract?.coordination ?? null;
    const kinds = relationshipKinds(coordination);
    const contractCoverage = ENSEMBLE_RELATIONSHIP_KINDS.filter((kind) => kinds.has(kind)).length
      / ENSEMBLE_RELATIONSHIP_KINDS.length;

    const bass = notesInRange(tracks.get("bass"), range);
    const bassPulses = groovePulsesForSection(
      song,
      section.id,
      "bassPulses",
      range.beatsPerBar,
    );
    const rhythmFoundation = onsetLaneFit(bass, bassPulses, 0.095, 0.75);
    const kickNotes = notesInRange(tracks.get("drums"), range)
      .filter((note) => [35, 36].includes(Math.round(finite(note?.pitch, -1))));
    const kickBassCloneRatio = overlapRatio(bass, kickNotes, 0.055);
    const bassIndependence = bass.length && kickNotes.length
      ? clamp(1 - Math.max(0, kickBassCloneRatio - 0.68) / 0.32)
      : 0.82;

    const melody = notesInRange(tracks.get("melody"), range);
    const counterpoint = notesInRange(tracks.get("counterpoint"), range);
    const counterPulses = groovePulsesForSection(
      song,
      section.id,
      "counterPulses",
      range.beatsPerBar,
    );
    const counterLaneFit = onsetLaneFit(counterpoint, counterPulses, 0.105, melody.length ? 0.66 : 0.75);
    let collisions = 0;
    for (const answer of counterpoint) {
      if (melody.some((lead) => Math.abs(finite(lead.start) - finite(answer.start)) < 0.105)) collisions += 1;
    }
    const collisionControl = counterpoint.length
      ? clamp(1 - (collisions / counterpoint.length) * 1.45)
      : melody.length ? 0.72 : 0.8;
    const leadDialogue = melody.length && counterpoint.length
      ? clamp(counterLaneFit * 0.58 + collisionControl * 0.42)
      : melody.length || counterpoint.length
        ? 0.68
        : 0.76;

    const chords = notesInRange(tracks.get("chords"), range);
    const pads = notesInRange(tracks.get("pad"), range);
    const harmonicNotes = [...chords, ...pads];
    const chordPulses = groovePulsesForSection(
      song,
      section.id,
      "chordPulses",
      range.beatsPerBar,
    );
    const chordLaneFit = onsetLaneFit(chords, chordPulses, 0.105, harmonicNotes.length ? 0.68 : 0.8);
    const kickOnsets = notesInRange(tracks.get("drums"), range)
      .filter((note) => [35, 36].includes(Math.round(finite(note?.pitch, -1))))
      .map((note) => finite(note.start));
    const bassOnsets = bass.map((note) => finite(note.start));
    const chordOnsets = uniqueOnsets(chords);
    const overloaded = chordOnsets.filter((start) => (
      kickOnsets.some((kick) => Math.abs(kick - start) <= 0.08)
      && bassOnsets.some((bassStart) => Math.abs(bassStart - start) <= 0.1)
    )).length;
    const foundationYield = chordOnsets.length
      ? clamp(1 - (overloaded / chordOnsets.length) * 0.75)
      : 0.82;
    const harmonicSupport = harmonicNotes.length
      ? clamp(chordLaneFit * 0.72 + foundationYield * 0.28)
      : 0.82;
    const melodyChordCrowding = registerCrowding(melody, chords, 7, 0.18);
    const leadHarmonySeparation = clamp(1 - melodyChordCrowding);
    const supportNotes = [...pads, ...notesInRange(tracks.get("arp"), range)];
    const supportForegroundOverlap = overlapRatio(supportNotes, [...melody, ...counterpoint], 0.14);
    const supportRestraint = supportNotes.length
      ? clamp(1 - Math.max(0, supportForegroundOverlap - 0.55) / 0.45)
      : 0.88;

    const roles = coordination?.roles ?? contract?.ensembleRoles ?? {};
    const featuredTrack = String(coordination?.featuredTrack ?? contract?.featuredTrack ?? "melody");
    const featuredNotes = notesInRange(tracks.get(featuredTrack), range);
    const featurePresence = featuredNotes.length ? 1 : 0.5;
    const restingTracks = Object.entries(roles)
      .filter(([, role]) => role === "rest")
      .map(([trackId]) => trackId);
    const restCompliance = restingTracks.length
      ? average(restingTracks.map((trackId) => {
        const notes = notesInRange(tracks.get(trackId), range);
        if (notes.length <= range.bars) return 1;
        if (notes.length <= range.bars * 2) return 0.72;
        return 0.35;
      }), 0.7)
      : 1;
    const roleHierarchy = clamp(featurePresence * 0.58 + restCompliance * 0.42);

    const cadenceStart = Math.max(
      range.startBeat,
      range.endBeat - range.beatsPerBar * 1.25,
    );
    const cadenceTracks = ["melody", "counterpoint", "bass"];
    const goals = new Set((contract?.harmonicGoalPitchClasses ?? []).map((pitch) => mod(Math.round(pitch), 12)));
    const landings = cadenceTracks.map((trackId) => {
      const notes = notesInRange(tracks.get(trackId), range)
        .filter((note) => finite(note.start) >= cadenceStart - 1e-6)
        .sort((left, right) => finite(left.start) - finite(right.start));
      return notes.at(-1) ?? null;
    }).filter(Boolean);
    const cadenceGoalFit = landings.length && goals.size
      ? landings.filter((note) => goals.has(mod(Math.round(finite(note.pitch)), 12))).length / landings.length
      : 0.55;
    const cadenceTeam = clamp(0.45 + cadenceGoalFit * 0.55);

    const score = clamp(
      contractCoverage * 0.18
      + rhythmFoundation * 0.22
      + leadDialogue * 0.22
      + harmonicSupport * 0.13
      + roleHierarchy * 0.12
      + cadenceTeam * 0.08
      + bassIndependence * 0.05
      + leadHarmonySeparation * 0.05
      + supportRestraint * 0.05,
      0,
      1,
    );

    sectionReports.push({
      sectionId: contract.sectionId,
      score: Math.round(score * 100),
      contractCoverage: round(contractCoverage),
      rhythmFoundation: round(rhythmFoundation),
      leadDialogue: round(leadDialogue),
      harmonicSupport: round(harmonicSupport),
      roleHierarchy: round(roleHierarchy),
      cadenceTeam: round(cadenceTeam),
      collisionControl: round(collisionControl),
      kickBassCloneRatio: round(kickBassCloneRatio),
      bassIndependence: round(bassIndependence),
      melodyChordCrowding: round(melodyChordCrowding),
      leadHarmonySeparation: round(leadHarmonySeparation),
      supportForegroundOverlap: round(supportForegroundOverlap),
      supportRestraint: round(supportRestraint),
    });
  }

  const metrics = {
    contractCoverage: round(average(sectionReports.map((entry) => entry.contractCoverage), 0)),
    rhythmFoundation: round(average(sectionReports.map((entry) => entry.rhythmFoundation), 0.55)),
    leadDialogue: round(average(sectionReports.map((entry) => entry.leadDialogue), 0.55)),
    harmonicSupport: round(average(sectionReports.map((entry) => entry.harmonicSupport), 0.55)),
    roleHierarchy: round(average(sectionReports.map((entry) => entry.roleHierarchy), 0.55)),
    cadenceTeam: round(average(sectionReports.map((entry) => entry.cadenceTeam), 0.55)),
    collisionControl: round(average(sectionReports.map((entry) => entry.collisionControl), 0.55)),
    kickBassCloneRatio: round(average(sectionReports.map((entry) => entry.kickBassCloneRatio), 0)),
    bassIndependence: round(average(sectionReports.map((entry) => entry.bassIndependence), 0.82)),
    melodyChordCrowding: round(average(sectionReports.map((entry) => entry.melodyChordCrowding), 0)),
    leadHarmonySeparation: round(average(sectionReports.map((entry) => entry.leadHarmonySeparation), 0.8)),
    supportForegroundOverlap: round(average(sectionReports.map((entry) => entry.supportForegroundOverlap), 0)),
    supportRestraint: round(average(sectionReports.map((entry) => entry.supportRestraint), 0.88)),
  };
  const score = Math.round(average(sectionReports.map((entry) => entry.score), 55));
  const passed = score >= 70
    && metrics.contractCoverage >= 0.98
    && metrics.rhythmFoundation >= 0.45
    && metrics.leadDialogue >= 0.55
    && metrics.cadenceTeam >= 0.5;

  const weakestSection = [...sectionReports].sort((left, right) => left.score - right.score)[0] ?? null;

  return {
    version: 2,
    passed,
    reason: passed ? "ensemble-contract-honored" : "ensemble-contract-weak",
    score,
    metrics,
    weakestSection,
    sections: sectionReports,
  };
}
