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
  const cadenceLeaders = ["melody", "counterpoint", "bass"];

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
        leaders: cadenceLeaders,
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
      version: 1,
      passed: false,
      reason: "missing-ensemble-contracts",
      score: 55,
      metrics: {
        contractCoverage: 0,
        rhythmFoundation: 0.55,
        leadDialogue: 0.55,
        harmonicSupport: 0.55,
        roleHierarchy: 0.55,
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
    const bassTagged = bass.filter((note) => (
      note?.ensemblePartner === "groove-dna"
      || String(note?.ensembleCoordinationRole ?? "").includes("groove-dna")
    )).length;
    const rhythmFoundation = !bass.length
      ? 0.75
      : bassTagged
        ? clamp(0.25 + (bassTagged / bass.length) * 1.15)
        : 0.2;

    const melody = notesInRange(tracks.get("melody"), range);
    const counterpoint = notesInRange(tracks.get("counterpoint"), range);
    const dialogueNotes = [
      ...melody.map((note) => ({ ...note, _trackId: "melody" })),
      ...counterpoint.map((note) => ({ ...note, _trackId: "counterpoint" })),
    ];
    const dialogueTagged = dialogueNotes.filter((note) => (
      (note._trackId === "melody" && note?.ensemblePartner === "counterpoint")
      || (note._trackId === "counterpoint" && note?.ensemblePartner === "melody")
      || ["lead-call", "counter-answer", "counter-answer-moved", "featured-answer"]
        .some((role) => String(note?.ensembleCoordinationRole ?? "").includes(role))
    )).length;
    const leadDialogue = melody.length && counterpoint.length
      ? clamp((dialogueTagged / Math.max(1, dialogueNotes.length)) * 1.18)
      : dialogueNotes.length
        ? 0.65
        : 0.75;

    let collisions = 0;
    for (const answer of counterpoint) {
      if (melody.some((lead) => Math.abs(finite(lead.start) - finite(answer.start)) < 0.105)) collisions += 1;
    }
    const collisionControl = counterpoint.length
      ? clamp(1 - (collisions / counterpoint.length) * 1.45)
      : 0.78;

    const harmonicNotes = [
      ...notesInRange(tracks.get("chords"), range),
      ...notesInRange(tracks.get("pad"), range),
    ];
    const harmonicTagged = harmonicNotes.filter((note) => (
      note?.ensemblePartner === "rhythm-section"
      || ["harmonic-pocket", "harmonic-bed-yield", "negative-space-yield"]
        .some((role) => String(note?.ensembleCoordinationRole ?? "").includes(role))
    )).length;
    const harmonicSupport = !harmonicNotes.length
      ? 0.8
      : harmonicTagged
        ? clamp(0.72 + (harmonicTagged / harmonicNotes.length) * 0.28)
        : 0.72;

    const roles = coordination?.roles ?? contract?.ensembleRoles ?? {};
    const restingTracks = Object.entries(roles)
      .filter(([, role]) => role === "rest")
      .map(([trackId]) => trackId);
    const roleHierarchy = restingTracks.length
      ? average(restingTracks.map((trackId) => {
        const notes = notesInRange(tracks.get(trackId), range);
        if (notes.length <= range.bars) return 1;
        if (notes.length <= range.bars * 2) return 0.72;
        return 0.35;
      }), 0.7)
      : 1;

    const score = clamp(
      contractCoverage * 0.2
      + rhythmFoundation * 0.22
      + leadDialogue * 0.22
      + harmonicSupport * 0.12
      + roleHierarchy * 0.12
      + collisionControl * 0.12,
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
      collisionControl: round(collisionControl),
    });
  }

  const metrics = {
    contractCoverage: round(average(sectionReports.map((entry) => entry.contractCoverage), 0)),
    rhythmFoundation: round(average(sectionReports.map((entry) => entry.rhythmFoundation), 0.55)),
    leadDialogue: round(average(sectionReports.map((entry) => entry.leadDialogue), 0.55)),
    harmonicSupport: round(average(sectionReports.map((entry) => entry.harmonicSupport), 0.55)),
    roleHierarchy: round(average(sectionReports.map((entry) => entry.roleHierarchy), 0.55)),
    collisionControl: round(average(sectionReports.map((entry) => entry.collisionControl), 0.55)),
  };
  const score = Math.round(average(sectionReports.map((entry) => entry.score), 55));
  const passed = score >= 70
    && metrics.contractCoverage >= 0.98
    && metrics.rhythmFoundation >= 0.45
    && metrics.leadDialogue >= 0.6;

  const weakestSection = [...sectionReports].sort((left, right) => left.score - right.score)[0] ?? null;

  return {
    version: 1,
    passed,
    reason: passed ? "ensemble-contract-honored" : "ensemble-contract-weak",
    score,
    metrics,
    weakestSection,
    sections: sectionReports,
  };
}
