import { createProfessionalGenerationGauntletSong } from "./professional-gauntlet-song.js";
import { createPerformanceShadowReport } from "./performance-shadow.js";

const DB_RECORD_SCHEMA = "midi-arcade/generation-record@1";

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integer(value, fallback = null) {
  const number = finite(value, fallback);
  return number == null ? fallback : Math.round(number);
}

function boolInt(value, fallback = 0) {
  if (value == null) return fallback;
  return value ? 1 : 0;
}

function safeJson(value) {
  return JSON.stringify(value ?? null);
}

function text(value, fallback = null) {
  if (value == null) return fallback;
  return String(value);
}

function stableHash(input) {
  let hash = 2166136261;
  for (const char of String(input)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function deriveSongId(song, config = {}) {
  if (song?.id != null) return String(song.id);
  const signature = [
    song?.seed ?? config?.seed ?? "seed",
    song?.genre ?? song?.meta?.genre ?? config?.genre ?? "genre",
    song?.bars ?? config?.bars ?? "bars",
    song?.title ?? "untitled",
  ].join("|");
  return `song-${stableHash(signature)}`;
}

function deriveRunId({ runId, songId, kind, config, startedAt }) {
  if (runId != null) return String(runId);
  return `run-${stableHash([
    songId,
    kind,
    config?.seed ?? "",
    startedAt ?? "",
  ].join("|"))}`;
}

function deriveSectionBounds(section, beatsPerBar) {
  const startBar = integer(section?.startBar ?? section?.start, 0);
  const bars = Math.max(1, integer(section?.bars, 1));
  const endBar = integer(section?.endBar, startBar + bars - 1);
  const startBeat = finite(section?.startBeat, startBar * beatsPerBar);
  const endBeat = finite(section?.endBeat, (endBar + 1) * beatsPerBar);
  return { startBar, endBar, startBeat, endBeat };
}

function findSectionId(sections, startBeat) {
  const beat = finite(startBeat, null);
  if (beat == null) return null;
  for (const section of sections) {
    if (beat >= section._startBeat && beat < section._endBeat) return section.id;
  }
  return null;
}

function qualityRows(runId, song) {
  const details = song?.meta?.scoreDetails ?? {};
  const evaluation = details?.evaluation ?? details?.critic ?? song?.qualityEvaluation ?? null;
  const subscores = evaluation?.subscores ?? details?.subscores ?? {};
  const release = details?.releaseGate ?? song?.releaseGate ?? {};
  const score = finite(
    evaluation?.score
      ?? details?.totalScore
      ?? song?.meta?.score
      ?? song?.meta?.qualityScore,
    null,
  );
  if (score == null && !Object.keys(subscores).length && !Object.keys(release).length) return [];
  const row = {
    id: `${runId}:quality:final`,
    generation_run_id: runId,
    evaluation_phase: "final",
    overall_score: score,
    harmony_score: finite(subscores.harmony ?? subscores.tonal ?? subscores.harmonicIntegrity, null),
    groove_score: finite(subscores.groove ?? subscores.rhythm ?? subscores.pocket, null),
    structure_score: finite(subscores.structure ?? subscores.arrangement, null),
    density_score: finite(subscores.density, null),
    register_score: finite(subscores.register ?? subscores.registerHealth, null),
    melody_score: finite(subscores.melody ?? subscores.melodicContinuity, null),
    ensemble_score: finite(subscores.ensemble ?? subscores.separation, null),
    transition_score: finite(subscores.transition ?? subscores.transitions, null),
    novelty_score: finite(subscores.novelty, null),
    genre_authenticity_score: finite(subscores.genreAuthenticity ?? subscores.genre, null),
    preview_export_parity_score: finite(subscores.previewExportParity ?? details.previewExportParity, null),
    passed: boolInt(release?.passed ?? details?.passed ?? false, 0),
    weaknesses_json: safeJson(details?.weaknesses ?? release?.weaknesses ?? []),
    evaluation_json: safeJson({ evaluation, release, scoreDetails: details }),
  };
  return [row];
}

function stageRows(runId, stages = [], runStartedAt = null) {
  const list = Array.isArray(stages) ? stages : [];
  const firstAt = finite(list[0]?.at, null);
  const wallClockStart = runStartedAt == null ? null : Date.parse(String(runStartedAt));
  const stageTimestamp = (value) => {
    const at = finite(value, null);
    if (at == null || firstAt == null || !Number.isFinite(wallClockStart)) return null;
    return new Date(wallClockStart + Math.max(0, at - firstAt)).toISOString();
  };
  return list.map((stage, index) => {
    const at = finite(stage?.at, null);
    const nextAt = finite(list[index + 1]?.at, null);
    return {
      generation_run_id: runId,
      stage: text(stage?.stage, "unknown"),
      stage_order: index,
      started_at: stageTimestamp(at),
      completed_at: stageTimestamp(nextAt),
      duration_ms: at != null && nextAt != null ? Math.max(0, Math.round(nextAt - at)) : null,
      status: text(stage?.status, "complete"),
      details_json: safeJson(stage?.detail ?? {}),
    };
  });
}

function debuggerRows(runId, songId, stages = []) {
  return stages.map((stage, index) => ({
    generation_run_id: runId,
    song_id: songId,
    severity: stage?.status === "failed" ? "error" : "info",
    subsystem: "generation",
    code: `stage-${stage?.stage ?? "unknown"}`,
    message: `${String(stage?.stage ?? "generation").toUpperCase()} stage ${stage?.status ?? "complete"}`,
    context_json: stage?.details_json ?? safeJson({}),
    occurred_at: stage?.started_at ?? stage?.completed_at ?? null,
    stage_order: index,
  }));
}

function candidateRows(runId, song) {
  const search = song?.meta?.scoreDetails?.candidateSearch;
  const candidates = search?.candidates ?? search?.results ?? [];
  if (!Array.isArray(candidates)) return [];
  return candidates.map((candidate, index) => ({
    id: `${runId}:candidate:${index}`,
    generation_run_id: runId,
    candidate_index: index,
    seed: text(candidate?.seed, null),
    score: finite(candidate?.score ?? candidate?.totalScore, null),
    accepted: boolInt(candidate?.accepted ?? candidate?.selected, 0),
    rejection_reason: text(candidate?.rejectionReason ?? candidate?.reason, null),
    metrics_json: safeJson(candidate?.metrics ?? candidate?.subscores ?? {}),
    candidate_json: safeJson(candidate),
  }));
}

function repairRows(runId, song) {
  const details = song?.meta?.scoreDetails ?? {};
  const repairs = details?.repairs
    ?? details?.candidateSearch?.repairs
    ?? song?.repairActions
    ?? [];
  if (!Array.isArray(repairs)) return [];
  return repairs.map((repair, index) => ({
    id: `${runId}:repair:${index}`,
    generation_run_id: runId,
    quality_evaluation_id: `${runId}:quality:final`,
    target_scope: text(repair?.targetScope ?? repair?.scope, "song"),
    target_id: text(repair?.targetId ?? repair?.trackId ?? repair?.sectionId, null),
    repair_type: text(repair?.repairType ?? repair?.type ?? repair?.focus ?? "targeted-repair"),
    before_metrics_json: safeJson(repair?.beforeMetrics ?? repair?.before ?? null),
    repair_json: safeJson(repair),
    after_metrics_json: safeJson(repair?.afterMetrics ?? repair?.after ?? null),
    accepted: boolInt(repair?.accepted ?? repair?.selected, 0),
  }));
}

export function createGenerationDatabaseRecord({
  kind = "new",
  config = {},
  sourceSong = null,
  result = null,
  song = result?.song ?? null,
  runId = null,
  startedAt = null,
  completedAt = null,
  durationMs = null,
  stages = [],
  outcome = result?.status ?? "committed",
  engineVersion = null,
} = {}) {
  if (!song || !Array.isArray(song.tracks)) {
    throw new TypeError("generation database record requires an accepted song with tracks");
  }

  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const songId = deriveSongId(song, config);
  const generationRunId = deriveRunId({ runId, songId, kind, config, startedAt });
  const structure = Array.isArray(song?.structure)
    ? song.structure
    : Array.isArray(song?.sections) ? song.sections : [];

  const completedStamp = text(completedAt, null);
  const startedStamp = text(startedAt, completedStamp);
  const sectionRows = structure.map((section, index) => {
    const bounds = deriveSectionBounds(section, beatsPerBar);
    const sourceSectionId = text(section?.id, `section-${index}`);
    return {
      id: `${generationRunId}:section:${sourceSectionId}`,
      source_section_id: sourceSectionId,
      song_id: songId,
      generation_run_id: generationRunId,
      name: text(section?.name, `Section ${index + 1}`),
      section_type: text(section?.type ?? section?.role ?? section?.name, "section"),
      ordinal: index,
      start_bar: bounds.startBar,
      end_bar: bounds.endBar,
      energy: finite(section?.energy ?? section?.intensity ?? section?.intent?.energy, null),
      density_target: finite(section?.densityTarget ?? section?.intent?.density, null),
      payoff_role: text(section?.payoffRole ?? section?.intent?.role, null),
      section_json: safeJson(section),
      _startBeat: bounds.startBeat,
      _endBeat: bounds.endBeat,
    };
  });

  const gauntletSong = createProfessionalGenerationGauntletSong(song);
  const trackRows = [];
  const trackIdBySource = new Map();

  for (const [trackIndex, track] of song.tracks.entries()) {
    const role = text(track?.id ?? track?.role, `track-${trackIndex}`);
    const sourceTrackId = text(track?.id ?? track?.trackId ?? track?.name, role);
    const trackId = `${songId}:${generationRunId}:track:${role}`;
    const pitches = (track?.notes ?? []).map((note) => integer(note?.pitch, null)).filter((pitch) => pitch != null);
    trackIdBySource.set(sourceTrackId, trackId);
    trackRows.push({
      id: trackId,
      song_id: songId,
      generation_run_id: generationRunId,
      role,
      instrument_name: text(track?.name ?? track?.instrumentName, null),
      midi_channel: integer(track?.channel ?? track?.midiChannel, role === "drums" ? 10 : null),
      midi_program: integer(track?.program ?? track?.midiProgram, null),
      octave_center: pitches.length ? Math.round(pitches.reduce((sum, pitch) => sum + pitch, 0) / pitches.length / 12) : null,
      min_pitch: pitches.length ? Math.min(...pitches) : null,
      max_pitch: pitches.length ? Math.max(...pitches) : null,
      muted: boolInt(track?.muted, 0),
      soloed: boolInt(track?.soloed, 0),
      track_json: safeJson(track),
    });
  }

  const sectionIdBySource = new Map(
    sectionRows.map((section) => [section.source_section_id, section.id]),
  );
  const sourceOrderedEvents = [...gauntletSong.musicalEvents].sort((left, right) => (
    finite(left?.sourceRef?.trackIndex, Number.MAX_SAFE_INTEGER)
      - finite(right?.sourceRef?.trackIndex, Number.MAX_SAFE_INTEGER)
    || finite(left?.sourceRef?.noteIndex, Number.MAX_SAFE_INTEGER)
      - finite(right?.sourceRef?.noteIndex, Number.MAX_SAFE_INTEGER)
    || finite(left?.time, 0) - finite(right?.time, 0)
    || String(left?.id ?? "").localeCompare(String(right?.id ?? ""))
  ));
  const musicalEvents = sourceOrderedEvents.map((event, eventIndex) => {
    const trackId = trackIdBySource.get(event.trackId)
      ?? `${songId}:${generationRunId}:track:${event.roleId || "unknown"}`;
    return {
      id: `${generationRunId}:event:${eventIndex}`,
      track_id: trackId,
      section_id: sectionIdBySource.get(text(event.sectionId, null))
        ?? findSectionId(sectionRows, event.performed?.startBeat ?? event.time),
      event_type: text(event.eventType, "note"),
      start_beat: finite(event.performed?.startBeat ?? event.time, 0),
      duration_beats: Math.max(0, finite(event.performed?.durationBeats ?? event.duration, 0)),
      pitch: integer(event.performed?.renderedMidiPitch ?? event.renderedMidiPitch, null),
      velocity: integer(event.performed?.velocity ?? event.velocity, null),
      probability: Math.min(1, Math.max(0, finite(event.intent?.probability ?? event.probability, 1))),
      articulation: text(event.performed?.articulation ?? event.articulation, null),
      microtiming_ms: finite(event.performed?.microtimingMs ?? event.microtimingMs, 0),
      source: text(event.intent?.source, "composer"),
      locked: boolInt(event.intent?.locked ?? event.locked, 0),
      event_json: safeJson(event),
    };
  });

  const cleanSections = sectionRows.map(({ _startBeat, _endBeat, ...row }) => row);
  const harmony = clone(song?.harmony ?? []);
  const groove = clone(song?.grooveConductor ?? song?.grooveDNA ?? null);
  const blueprint = clone(song?.songBlueprint ?? song?.songPlan ?? null);
  const scoreSearch = song?.meta?.scoreDetails?.candidateSearch ?? {};

  const songVersionId = `${songId}:version:${generationRunId}`;
  const persistedStages = stageRows(generationRunId, stages, startedStamp);
  const performanceShadow = createPerformanceShadowReport(song, {
    humanize: finite(config?.humanize, 0.65),
    seed: text(config?.seed ?? song?.seed, generationRunId),
  });
  const debuggerEvents = [
    ...debuggerRows(generationRunId, songId, persistedStages),
    {
      generation_run_id: generationRunId,
      song_id: songId,
      severity: performanceShadow.promotionCandidate ? "info" : "warning",
      subsystem: "performance-shadow",
      code: "performance-shadow-v1",
      message: !performanceShadow.safeToAudition
        ? "Performance shadow comparison detected a technical safety risk"
        : performanceShadow.promotionCandidate
          ? "Performance shadow comparison passed technical and groove safety checks"
          : "Performance shadow comparison is technically safe but needs groove review",
      context_json: safeJson(performanceShadow),
      occurred_at: completedStamp ?? startedStamp,
      stage_order: persistedStages.length,
    },
  ];

  return Object.freeze({
    schema: DB_RECORD_SCHEMA,
    song: Object.freeze({
      id: songId,
      title: text(song?.title, "Untitled"),
      genre: text(song?.genre ?? song?.meta?.genre ?? config?.genre, "unknown"),
      bpm: finite(song?.tempo ?? song?.bpm ?? song?.meta?.tempo ?? config?.tempo, 120),
      musical_key: text(song?.key ?? song?.meta?.key ?? config?.key, "C"),
      scale: text(song?.scale ?? song?.meta?.scale ?? config?.scale, "minor"),
      time_signature: Array.isArray(song?.meta?.timeSignature)
        ? song.meta.timeSignature.join("/")
        : text(song?.timeSignature, "4/4"),
      bars: integer(song?.bars ?? song?.meta?.bars ?? config?.bars, 0),
      seed: text(song?.seed ?? config?.seed, null),
      status: "accepted",
      selected_version_id: songVersionId,
      snapshot_json: safeJson(song),
    }),
    songVersion: Object.freeze({
      id: songVersionId,
      song_id: songId,
      version_number: Math.max(1, integer(song?.revision, 0) + 1),
      source_version_id: text(sourceSong?.selectedVersionId ?? sourceSong?.selected_version_id, null),
      change_reason: kind,
      snapshot_json: safeJson(song),
    }),
    generationRun: Object.freeze({
      id: generationRunId,
      song_id: songId,
      source_song_id: text(sourceSong?.id, null),
      kind: text(kind, "new"),
      engine_version: text(engineVersion ?? song?.schema, null),
      producer_brain_id: text(config?.producerBrain?.id, null),
      producer_brain_version: integer(config?.producerBrain?.version, null),
      thinking_depth: text(config?.thinkingDepth, null),
      candidate_count: integer(scoreSearch?.totalCandidates ?? config?.candidateCount, null),
      adaptive_candidates: boolInt(config?.adaptiveCandidates !== false, 1),
      weakness_aware_search: boolInt(config?.weaknessAwareSearch !== false, 1),
      targeted_repair: boolInt(config?.targetedRepair !== false, 1),
      seed: text(config?.seed ?? song?.seed, null),
      genre: text(config?.genre ?? song?.genre, null),
      requested_bars: integer(config?.bars ?? song?.bars, null),
      started_at: startedStamp,
      completed_at: completedStamp,
      runtime_ms: integer(durationMs, null),
      outcome: text(outcome, "committed"),
      config_json: safeJson(config),
    }),
    blueprint: blueprint == null ? null : Object.freeze({
      id: `${generationRunId}:blueprint`,
      generation_run_id: generationRunId,
      intent: text(blueprint?.intent?.summary ?? blueprint?.intent ?? blueprint?.producerIntent?.narrative, null),
      energy_arc_json: safeJson(blueprint?.energyArc ?? blueprint?.producerIntent?.scenes ?? null),
      arrangement_plan_json: safeJson(blueprint?.sections ?? blueprint?.sectionPlans ?? null),
      harmony_plan_json: safeJson(blueprint?.harmonyPlan ?? null),
      groove_plan_json: safeJson(blueprint?.groovePlan ?? null),
      instrumentation_plan_json: safeJson(blueprint?.orchestrationMatrix ?? blueprint?.instrumentation ?? null),
      transition_plan_json: safeJson(blueprint?.transitionPlan ?? null),
      narrative_plan_json: safeJson(blueprint?.narrativePlan ?? blueprint?.producerIntent ?? null),
      blueprint_json: safeJson(blueprint),
    }),
    grooveDna: groove == null ? null : Object.freeze({
      id: `${generationRunId}:groove`,
      generation_run_id: generationRunId,
      genre: text(song?.genre ?? config?.genre, "unknown"),
      tempo: finite(song?.tempo ?? song?.bpm ?? config?.tempo, 120),
      swing: finite(groove?.swing ?? song?.meta?.swing ?? config?.swing, 0),
      pocket: finite(groove?.pocket ?? groove?.humanGroovePrior?.influence, 0),
      subdivision: text(groove?.subdivision, null),
      kick_grammar_json: safeJson(groove?.kickGrammar ?? groove?.grammar?.kick ?? groove?.bars ?? []),
      snare_grammar_json: safeJson(groove?.snareGrammar ?? groove?.grammar?.snare ?? groove?.bars ?? []),
      hat_grammar_json: safeJson(groove?.hatGrammar ?? groove?.grammar?.hat ?? groove?.bars ?? []),
      percussion_grammar_json: safeJson(groove?.percussionGrammar ?? groove?.grammar?.percussion ?? null),
      bass_relationship_json: safeJson(groove?.bassRelationship ?? groove?.relationships?.bass ?? null),
      chord_relationship_json: safeJson(groove?.chordRelationship ?? groove?.relationships?.chords ?? null),
      lead_relationship_json: safeJson(groove?.leadRelationship ?? groove?.relationships?.lead ?? null),
      transformations_json: safeJson(groove?.transformations ?? null),
      humanization_json: safeJson(groove?.humanization ?? groove?.humanGroovePrior ?? null),
      groove_json: safeJson(groove),
    }),
    harmonyTimeline: Object.freeze({
      id: `${generationRunId}:harmony`,
      generation_run_id: generationRunId,
      key_center: text(song?.key ?? song?.meta?.key ?? config?.key, "C"),
      scale: text(song?.scale ?? song?.meta?.scale ?? config?.scale, "minor"),
      chord_language: text(song?.meta?.chordLanguage ?? config?.chordPath, null),
      modulation_policy: text(song?.meta?.modulationPolicy, null),
      harmony_json: safeJson(harmony),
    }),
    sections: Object.freeze(cleanSections),
    tracks: Object.freeze(trackRows),
    musicalEventSchema: gauntletSong.musicalEventSchema,
    musicalEvents: Object.freeze(musicalEvents),
    performanceShadow,
    stages: Object.freeze(persistedStages),
    debuggerEvents: Object.freeze(debuggerEvents),
    qualityEvaluations: Object.freeze(qualityRows(generationRunId, song)),
    candidateResults: Object.freeze(candidateRows(generationRunId, song)),
    repairActions: Object.freeze(repairRows(generationRunId, song)),
  });
}

export const GENERATION_DATABASE_RECORD_SCHEMA = DB_RECORD_SCHEMA;
