import * as engine from "../src/music-engine.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import { evaluateMelodySectionMemory } from "../src/core/melody-section-memory.js";

const options = {
  seed: "melody-memory-gauntlet-hipHop-16",
  genre: "hipHop",
  key: "A",
  scale: "minor",
  bars: 16,
  energy: 0.72,
  complexity: 0.74,
  variation: 0.76,
  evolution: 0.72,
  swing: 0.16,
  humanize: 0.12,
};

const qualityConfig = {
  arrangementEvolution: false,
  returnDevelopment: false,
  groovePocketRefinement: false,
  densityRefinement: false,
  phraseResolutionRefinement: false,
  repetitionRefinement: false,
  registerHealthRefinement: false,
  fusionPerformanceRefinement: false,
  melodyContinuityRefinement: false,
  melodyPhraseRefinement: false,
  melodySectionDevelopmentRefinement: true,
  bassContinuityRefinement: false,
  ensembleContinuityRefinement: false,
  genreIdentityRefinement: false,
  transitionFxRefinement: false,
};

const composed = engine.generateNew(options);
const processed = applySongOutputQualityPipeline(composed, qualityConfig);
const song = processed.song;
const memory = processed.melodySectionMemoryDiagnostics ?? evaluateMelodySectionMemory(song);
const weakest = memory?.weakestSection ?? null;

const section = (id) => (song.structure ?? []).find((entry) => String(entry.id) === String(id));
const notesFor = (id) => {
  const bounds = section(id);
  if (!bounds) return [];
  return (song.tracks.find((track) => track.id === "melody")?.notes ?? [])
    .filter((note) => note.start >= bounds.startBeat - 1e-6 && note.start < bounds.endBeat - 1e-6)
    .map((note) => ({
      pitch: note.pitch,
      pc: ((note.pitch % 12) + 12) % 12,
      start: note.start,
      duration: note.duration,
      velocity: note.velocity,
      motifMemoryVariantId: note.motifMemoryVariantId ?? null,
      motifMemoryCore: Boolean(note.motifMemoryCore),
      motifMemorySourceSectionId: note.motifMemorySourceSectionId ?? null,
      motifMemoryRelationship: note.motifMemoryRelationship ?? null,
      motifMemoryTransform: note.motifMemoryTransform ?? null,
      dawRegisterAdjusted: Boolean(note.dawRegisterAdjusted),
      dawRegisterShift: note.dawRegisterShift ?? null,
      dawRegisterRole: note.dawRegisterRole ?? null,
      dawRegisterContrastShift: note.dawRegisterContrastShift ?? null,
      melodicFlowRepair: note.melodicFlowRepair ?? null,
      registerIntegrityRepair: note.registerIntegrityRepair ?? null,
      continuityRole: note.continuityRole ?? null,
      sectionDevelopmentRole: note.sectionDevelopmentRole ?? null,
      melodyIntentRole: note.melodyIntentRole ?? null,
      melodyIntentBaseDegree: note.melodyIntentBaseDegree ?? null,
      melodyIntentConstrained: note.melodyIntentConstrained ?? null,
      finalAssemblyRole: note.finalAssemblyRole ?? null,
    }));
};

const authoring = song.motifs?.motifMemoryAuthoring ?? null;
console.log("TRACE_MEMORY", JSON.stringify({
  memory,
  repair: processed.melodySectionDevelopmentDiagnostics ?? null,
  authoring,
  dawRegister: song.dawRegister ?? null,
  registerIntegrity: song.registerIntegrity ?? null,
  firstPassContinuity: song.firstPassContinuity ?? null,
  weakest,
  sourceSection: weakest?.sourceSectionId ? section(weakest.sourceSectionId) : null,
  targetSection: weakest?.sectionId ? section(weakest.sectionId) : null,
  sourceNotes: weakest?.sourceSectionId ? notesFor(weakest.sourceSectionId) : [],
  targetNotes: weakest?.sectionId ? notesFor(weakest.sectionId) : [],
}, null, 2));
