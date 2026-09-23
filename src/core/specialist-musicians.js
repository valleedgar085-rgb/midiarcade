import { cloneValue } from "./clone-value.js";
import {
  acceptCompositionCandidate,
  createCompositionCandidate,
  createDirectorDirective,
} from "./blueprint-composer.js";
import { createProfessionalGenerationGauntletSong } from "./professional-gauntlet-song.js";
import { checkSpecialistEnsemble } from "./specialist-ensemble-checker.js";
import { createGrooveDNA } from "./groove-intelligence.js";

export const SPECIALIST_MUSICIAN_ORDER = Object.freeze([
  "harmony",
  "groove",
  "drums",
  "bass",
  "chords",
  "lead",
  "counterline",
  "arp",
  "fx",
]);

const SPECIALIST_DEFINITIONS = Object.freeze({
  harmony: Object.freeze({
    id: "harmony",
    label: "Harmony Brain",
    kind: "authority",
    trackId: null,
    dependsOn: Object.freeze([]),
    owns: Object.freeze(["harmonyTimeline", "harmonic-language", "cadence-plan"]),
    reads: Object.freeze(["intent", "blueprint", "sections"]),
  }),
  groove: Object.freeze({
    id: "groove",
    label: "Groove Brain",
    kind: "authority",
    trackId: null,
    dependsOn: Object.freeze(["harmony"]),
    owns: Object.freeze(["grooveTimeline", "pocket", "microtiming-plan"]),
    reads: Object.freeze(["intent", "blueprint", "sections", "harmonyTimeline"]),
  }),
  drums: Object.freeze({
    id: "drums",
    label: "Drum Brain",
    kind: "performer",
    trackId: "drums",
    dependsOn: Object.freeze(["groove"]),
    owns: Object.freeze(["drums"]),
    reads: Object.freeze(["intent", "blueprint", "sections", "grooveTimeline"]),
  }),
  bass: Object.freeze({
    id: "bass",
    label: "Bass Brain",
    kind: "performer",
    trackId: "bass",
    dependsOn: Object.freeze(["harmony", "groove", "drums"]),
    owns: Object.freeze(["bass"]),
    reads: Object.freeze(["intent", "sections", "harmonyTimeline", "grooveTimeline", "drums"]),
  }),
  chords: Object.freeze({
    id: "chords",
    label: "Chord Brain",
    kind: "performer",
    trackId: "chords",
    dependsOn: Object.freeze(["harmony", "groove", "bass"]),
    owns: Object.freeze(["chords"]),
    reads: Object.freeze(["intent", "blueprint", "sections", "harmonyTimeline", "grooveTimeline", "bass"]),
  }),
  lead: Object.freeze({
    id: "lead",
    label: "Lead Brain",
    kind: "performer",
    trackId: "melody",
    dependsOn: Object.freeze(["harmony", "groove", "chords"]),
    owns: Object.freeze(["lead"]),
    reads: Object.freeze(["intent", "blueprint", "sections", "harmonyTimeline", "grooveTimeline", "chords"]),
  }),
  counterline: Object.freeze({
    id: "counterline",
    label: "Counterline Brain",
    kind: "performer",
    trackId: "counterpoint",
    dependsOn: Object.freeze(["lead", "chords", "groove"]),
    owns: Object.freeze(["counter"]),
    reads: Object.freeze(["intent", "sections", "harmonyTimeline", "grooveTimeline", "lead", "chords"]),
  }),
  arp: Object.freeze({
    id: "arp",
    label: "Arp Brain",
    kind: "performer",
    trackId: "pad",
    dependsOn: Object.freeze(["harmony", "groove", "chords", "lead"]),
    owns: Object.freeze(["arp", "atmosphere-pattern"]),
    reads: Object.freeze(["intent", "blueprint", "sections", "harmonyTimeline", "grooveTimeline", "chords", "lead"]),
  }),
  fx: Object.freeze({
    id: "fx",
    label: "FX / Transition Brain",
    kind: "authority",
    trackId: null,
    dependsOn: Object.freeze(["groove", "drums", "arp"]),
    owns: Object.freeze(["transition-plan", "vacuum-before-payoff", "fills", "handoffs"]),
    reads: Object.freeze(["intent", "blueprint", "sections", "grooveTimeline", "drums", "arp"]),
  }),
});

function tracksOf(song) {
  return Array.isArray(song?.tracks) ? song.tracks : [];
}

function hasTrack(song, trackId) {
  return tracksOf(song).some((track) => String(track?.id) === String(trackId));
}

function roleSnapshot(gauntletSong, roleIds = []) {
  return Object.freeze(Object.fromEntries(
    roleIds
      .filter((roleId) => gauntletSong?.instrumentRoles?.[roleId])
      .map((roleId) => [roleId, cloneValue(gauntletSong.instrumentRoles[roleId])]),
  ));
}

function contextForSpecialist(gauntletSong, specialistId, grooveDNA = null) {
  const shared = {
    intent: cloneValue(gauntletSong?.intent ?? null),
    sections: cloneValue(gauntletSong?.sections ?? []),
    grooveDNA: cloneValue(grooveDNA),
  };
  switch (specialistId) {
    case "harmony":
      return Object.freeze({
        ...shared,
        blueprint: cloneValue(gauntletSong?.blueprint ?? null),
        harmonyTimeline: cloneValue(gauntletSong?.harmonyTimeline ?? []),
      });
    case "groove":
      return Object.freeze({
        ...shared,
        blueprint: cloneValue(gauntletSong?.blueprint ?? null),
        harmonyTimeline: cloneValue(gauntletSong?.harmonyTimeline ?? []),
        grooveTimeline: cloneValue(gauntletSong?.grooveTimeline ?? []),
      });
    case "drums":
      return Object.freeze({
        ...shared,
        grooveTimeline: cloneValue(gauntletSong?.grooveTimeline ?? []),
        roles: roleSnapshot(gauntletSong, ["drums"]),
      });
    case "bass":
      return Object.freeze({
        ...shared,
        harmonyTimeline: cloneValue(gauntletSong?.harmonyTimeline ?? []),
        grooveTimeline: cloneValue(gauntletSong?.grooveTimeline ?? []),
        roles: roleSnapshot(gauntletSong, ["drums", "bass"]),
      });
    case "chords":
      return Object.freeze({
        ...shared,
        blueprint: cloneValue(gauntletSong?.blueprint ?? null),
        harmonyTimeline: cloneValue(gauntletSong?.harmonyTimeline ?? []),
        grooveTimeline: cloneValue(gauntletSong?.grooveTimeline ?? []),
        roles: roleSnapshot(gauntletSong, ["bass", "chords"]),
      });
    case "lead":
      return Object.freeze({
        ...shared,
        blueprint: cloneValue(gauntletSong?.blueprint ?? null),
        harmonyTimeline: cloneValue(gauntletSong?.harmonyTimeline ?? []),
        grooveTimeline: cloneValue(gauntletSong?.grooveTimeline ?? []),
        roles: roleSnapshot(gauntletSong, ["chords", "lead"]),
      });
    case "counterline":
      return Object.freeze({
        ...shared,
        harmonyTimeline: cloneValue(gauntletSong?.harmonyTimeline ?? []),
        grooveTimeline: cloneValue(gauntletSong?.grooveTimeline ?? []),
        roles: roleSnapshot(gauntletSong, ["chords", "lead", "counter"]),
      });
    case "arp":
      return Object.freeze({
        ...shared,
        blueprint: cloneValue(gauntletSong?.blueprint ?? null),
        harmonyTimeline: cloneValue(gauntletSong?.harmonyTimeline ?? []),
        grooveTimeline: cloneValue(gauntletSong?.grooveTimeline ?? []),
        roles: roleSnapshot(gauntletSong, ["chords", "lead", "arp", "fx"]),
      });
    case "fx":
      return Object.freeze({
        ...shared,
        blueprint: cloneValue(gauntletSong?.blueprint ?? null),
        grooveTimeline: cloneValue(gauntletSong?.grooveTimeline ?? []),
        roles: roleSnapshot(gauntletSong, ["drums", "arp", "fx"]),
      });
    default:
      throw new TypeError(`Unknown specialist musician: ${specialistId}`);
  }
}

function specialistRoute(id) {
  if (["groove", "drums", "bass"].includes(id)) return "groove-first";
  if (["lead", "counterline"].includes(id)) return "hook-first";
  return "harmony-first";
}

function specialistSeed(sourceSeed, id, index) {
  return `${String(sourceSeed ?? "midi-arcade")}:specialist:${String(index + 1).padStart(2, "0")}:${id}`;
}

function authorityResult(definition, context) {
  if (definition.id === "harmony") {
    return Object.freeze({
      timelineEvents: context.harmonyTimeline?.length ?? 0,
      sectionCount: context.sections?.length ?? 0,
      contract: "harmony-authority",
    });
  }
  if (definition.id === "groove") {
    return Object.freeze({
      grooveBars: context.grooveTimeline?.length ?? 0,
      sectionCount: context.sections?.length ?? 0,
      grooveDNAId: context.grooveDNA?.id ?? null,
      grammarId: context.grooveDNA?.grammarId ?? null,
      pipeline: Object.freeze([...(context.grooveDNA?.pipeline ?? [])]),
      contract: "groove-dna-authority",
    });
  }
  return Object.freeze({
    sectionCount: context.sections?.length ?? 0,
    contract: "transition-authority",
    responsibilities: definition.owns,
  });
}

export function specialistMusicianDefinition(id) {
  const definition = SPECIALIST_DEFINITIONS[id];
  if (!definition) throw new TypeError(`Unknown specialist musician: ${id}`);
  return definition;
}

export function createSpecialistDirectorPlan(song) {
  if (!song || !Array.isArray(song?.tracks)) {
    throw new TypeError("createSpecialistDirectorPlan requires a generated source song");
  }
  const gauntletSong = createProfessionalGenerationGauntletSong(song);
  const grooveDNA = createGrooveDNA({
    seed: song?.seed,
    genre: song?.meta?.genre ?? gauntletSong?.intent?.genre,
    bars: song?.meta?.bars,
    beatsPerBar: song?.meta?.beatsPerBar,
    complexity: song?.meta?.complexity ?? 0.58,
    variation: song?.meta?.variation ?? 0.48,
  }, { structure: song?.structure ?? song?.sections ?? [] });
  const specialists = SPECIALIST_MUSICIAN_ORDER.map((id) => {
    const definition = specialistMusicianDefinition(id);
    return Object.freeze({
      ...definition,
      context: contextForSpecialist(gauntletSong, id, grooveDNA),
      compositionRoute: specialistRoute(id),
    });
  });
  return Object.freeze({
    version: 1,
    id: "specialist-director-v1",
    sourceSongId: song?.id ?? null,
    sourceSeed: song?.seed ?? null,
    gauntletSong,
    grooveDNA,
    order: SPECIALIST_MUSICIAN_ORDER,
    specialists: Object.freeze(specialists),
    rules: Object.freeze({
      oneOwnerPerPhysicalTrack: true,
      preserveDeterminism: true,
      preserveKeySafety: true,
      preserveScopedMutation: true,
      compareBeforeCommit: true,
      ensembleCheckRequired: true,
      fxDoesNotCreateExtraMidiTrack: true,
    }),
  });
}

function stageDirective(plan, specialist, song, index) {
  const directorDirective = createDirectorDirective(song, { target: "track", trackId: specialist.trackId });
  const currentGauntletSong = createProfessionalGenerationGauntletSong(song);
  return Object.freeze({
    version: 1,
    specialistId: specialist.id,
    specialistLabel: specialist.label,
    index,
    owns: specialist.owns,
    dependsOn: specialist.dependsOn,
    reads: specialist.reads,
    trackId: specialist.trackId,
    route: specialist.compositionRoute,
    context: contextForSpecialist(currentGauntletSong, specialist.id, plan.grooveDNA),
    grooveDNA: plan.grooveDNA,
    directorDirective,
  });
}

export function runSpecialistMusicianGeneration(
  sourceSong,
  input = {},
  { composer } = {},
) {
  const plan = createSpecialistDirectorPlan(sourceSong);
  const before = cloneValue(sourceSong);
  let current = cloneValue(sourceSong);
  const stages = [];

  for (let index = 0; index < plan.specialists.length; index += 1) {
    const specialist = plan.specialists[index];

    if (specialist.kind === "authority") {
      const authorityContext = contextForSpecialist(
        createProfessionalGenerationGauntletSong(current),
        specialist.id,
        plan.grooveDNA,
      );
      stages.push(Object.freeze({
        specialistId: specialist.id,
        label: specialist.label,
        kind: specialist.kind,
        status: "published",
        trackId: null,
        seed: null,
        result: authorityResult(specialist, authorityContext),
      }));
      continue;
    }

    if (!hasTrack(current, specialist.trackId)) {
      stages.push(Object.freeze({
        specialistId: specialist.id,
        label: specialist.label,
        kind: specialist.kind,
        status: "skipped",
        reason: `track-missing:${specialist.trackId}`,
        trackId: specialist.trackId,
        seed: null,
      }));
      continue;
    }

    const seed = specialistSeed(input.seed ?? sourceSong?.seed, specialist.id, index);
    const directive = stageDirective(plan, specialist, current, index);
    const relationship = specialist.id === "bass"
      ? plan.grooveDNA?.relationships?.bass
      : specialist.id === "chords"
        ? plan.grooveDNA?.relationships?.chords
        : ["lead", "counterline", "arp"].includes(specialist.id)
          ? plan.grooveDNA?.relationships?.lead
          : null;
    const candidate = createCompositionCandidate(
      current,
      { target: "track", trackId: specialist.trackId },
      {
        ...input,
        seed,
        compositionRoute: specialist.compositionRoute,
        specialistMusician: directive,
        grooveDNA: plan.grooveDNA,
        specialistGroove: relationship,
        ...(input.syncopation == null && Number.isFinite(Number(relationship?.syncopation))
          ? { syncopation: Number(relationship.syncopation) }
          : {}),
        ...(input.swing == null && Number.isFinite(Number(plan.grooveDNA?.humanization?.swing))
          ? { swing: Number(plan.grooveDNA.humanization.swing) }
          : {}),
        ...(input.humanize == null && Number.isFinite(Number(plan.grooveDNA?.humanization?.timing))
          ? { humanize: Math.min(1, Number(plan.grooveDNA.humanization.timing) * 6) }
          : {}),
      },
      composer ? { composer } : undefined,
    );

    if (!candidate.validation.valid) {
      stages.push(Object.freeze({
        specialistId: specialist.id,
        label: specialist.label,
        kind: specialist.kind,
        status: "rejected",
        trackId: specialist.trackId,
        seed,
        issues: Object.freeze([...candidate.validation.issues]),
        judge: candidate.validation.judge,
      }));
      continue;
    }

    current = acceptCompositionCandidate(candidate);
    stages.push(Object.freeze({
      specialistId: specialist.id,
      label: specialist.label,
      kind: specialist.kind,
      status: "accepted",
      trackId: specialist.trackId,
      seed,
      issues: Object.freeze([]),
      judge: candidate.validation.judge,
    }));
  }

  const ensemble = checkSpecialistEnsemble(before, current, { plan, stages });
  return Object.freeze({
    version: 1,
    id: "specialist-generation-pass-v1",
    before,
    song: current,
    plan,
    stages: Object.freeze(stages),
    ensemble,
    accepted: ensemble.passed,
  });
}
