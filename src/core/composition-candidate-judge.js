import { roleRegisterWindow } from "./role-register-policy.js";
import { registerHealthScore } from "./register-health-refinement.js";
import { compareJazzQuality } from "./jazz-quality-lab.js";
import { grooveLaneForTrack } from "./groove-contract.js";
import { trackId, tracksOf } from "./composition-scope.js";

const EPSILON = 1e-6;
const PITCHED_ROLES = new Set(["bass", "chords", "melody", "counterpoint", "pad"]);
const CONTEXTUAL_HARMONY_ROLES = new Set(["bass", "melody", "counterpoint"]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function mod12(value) {
  return ((Math.round(finite(value)) % 12) + 12) % 12;
}

function noteStart(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time, 0);
}

function noteDuration(note) {
  return Math.max(0.02, finite(note?.duration ?? note?.length ?? note?.durationBeats, 0.25));
}

function noteEnd(note) {
  return noteStart(note) + noteDuration(note);
}

function track(song, id) {
  return tracksOf(song).find((candidate) => trackId(candidate) === String(id)) ?? null;
}

function structureOf(song) {
  return Array.isArray(song?.structure) ? song.structure
    : Array.isArray(song?.sections) ? song.sections
      : [];
}

function sectionRange(song, sectionId) {
  const section = structureOf(song).find((candidate) => String(candidate?.id) === String(sectionId));
  if (!section) return null;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = Number.isFinite(Number(section?.startBeat))
    ? Number(section.startBeat)
    : finite(section?.startBar ?? section?.start, 0) * beatsPerBar;
  const end = Number.isFinite(Number(section?.endBeat))
    ? Number(section.endBeat)
    : start + Math.max(1, finite(section?.bars, 1)) * beatsPerBar;
  const bars = Math.max(1, finite(section?.bars, (end - start) / beatsPerBar));
  return { section, start, end, bars, beatsPerBar };
}

function scopeRanges(song, selection = {}) {
  if (selection.sectionId != null) {
    const range = sectionRange(song, selection.sectionId);
    return range ? [range] : [];
  }
  const ranges = structureOf(song)
    .map((section) => sectionRange(song, section.id))
    .filter(Boolean);
  if (ranges.length) return ranges;
  const totalBeats = Math.max(
    finite(song?.meta?.totalBeats),
    finite(song?.meta?.bars) * Math.max(1, finite(song?.meta?.beatsPerBar, 4)),
  );
  return [{
    section: { id: "song", bars: finite(song?.meta?.bars, 1) },
    start: 0,
    end: Math.max(1, totalBeats || 4),
    bars: Math.max(1, finite(song?.meta?.bars, 1)),
    beatsPerBar: Math.max(1, finite(song?.meta?.beatsPerBar, 4)),
  }];
}

function targetTrackIds(song, selection = {}) {
  if (selection.target === "track" || selection.target === "section-track") {
    return new Set([String(selection.trackId)]);
  }
  return new Set(tracksOf(song).map(trackId));
}

function noteInRange(note, range) {
  return noteStart(note) >= range.start - EPSILON && noteStart(note) < range.end - EPSILON;
}

function scopedNotes(song, id, selection = {}) {
  const source = track(song, id)?.notes ?? [];
  if (selection.sectionId == null) return source;
  const range = sectionRange(song, selection.sectionId);
  return range ? source.filter((note) => noteInRange(note, range)) : [];
}

function harmonyAt(song, beat) {
  let result = song?.harmony?.[0] ?? null;
  for (const event of song?.harmony ?? []) {
    const start = finite(event?.start ?? event?.startBeat);
    const duration = Math.max(0.01, finite(event?.duration ?? event?.durationBeats, 0.25));
    if (start <= beat + EPSILON) result = event;
    if (beat >= start - EPSILON && beat < start + duration - EPSILON) return event;
  }
  return result;
}

function chordClasses(chord) {
  if (!Array.isArray(chord?.tones) || chord.tones.length < 2) return null;
  return new Set(chord.tones.map(mod12));
}

function circularDistance(left, right) {
  const distance = Math.abs(mod12(left) - mod12(right));
  return Math.min(distance, 12 - distance);
}

function isStrongOrLong(note) {
  const start = noteStart(note);
  return Math.abs(start - Math.round(start)) <= 0.065 || noteDuration(note) >= 0.72;
}

function harmonyMetrics(song, selection) {
  const targetIds = targetTrackIds(song, selection);
  let contextualNotes = 0;
  let chordToneNotes = 0;
  let harshStrongNotes = 0;

  for (const id of targetIds) {
    if (!CONTEXTUAL_HARMONY_ROLES.has(id)) continue;
    for (const note of scopedNotes(song, id, selection)) {
      if (!isStrongOrLong(note)) continue;
      const classes = chordClasses(harmonyAt(song, noteStart(note)));
      if (!classes?.size) continue;
      contextualNotes += 1;
      const pitchClass = mod12(note?.pitch ?? note?.note ?? note?.midi);
      if (classes.has(pitchClass)) {
        chordToneNotes += 1;
        continue;
      }
      const nearest = Math.min(...[...classes].map((candidate) => circularDistance(pitchClass, candidate)));
      if (nearest === 1) harshStrongNotes += 1;
    }
  }

  return {
    contextualNotes,
    chordToneNotes,
    chordFit: contextualNotes ? chordToneNotes / contextualNotes : 1,
    harshStrongNotes,
  };
}

function registerMetrics(song, selection) {
  const targetIds = targetTrackIds(song, selection);
  let violations = 0;
  let preferred = 0;
  let pitched = 0;
  const violationsByTrack = {};

  for (const id of targetIds) {
    const window = roleRegisterWindow(id);
    if (!window || !PITCHED_ROLES.has(id)) continue;
    let trackViolations = 0;
    for (const note of scopedNotes(song, id, selection)) {
      const pitch = finite(note?.pitch ?? note?.note ?? note?.midi, NaN);
      if (!Number.isFinite(pitch)) continue;
      pitched += 1;
      if (pitch < window.min || pitch > window.max) {
        violations += 1;
        trackViolations += 1;
      }
      if (pitch >= (window.preferredMin ?? window.min) && pitch <= (window.preferredMax ?? window.max)) {
        preferred += 1;
      }
    }
    if (trackViolations) violationsByTrack[id] = trackViolations;
  }

  const melodySelected = targetIds.has("melody");
  const melodyHealth = melodySelected
    ? registerHealthScore(scopedNotes(song, "melody", selection))
    : null;

  return {
    violations,
    violationsByTrack,
    preferredRatio: pitched ? preferred / pitched : 1,
    melodyHealth,
  };
}

function sameTrackCollisionCount(song, selection) {
  const targetIds = targetTrackIds(song, selection);
  let collisions = 0;
  for (const id of targetIds) {
    if (id === "drums") continue;
    const notes = [...scopedNotes(song, id, selection)]
      .sort((left, right) => noteStart(left) - noteStart(right) || finite(left?.pitch) - finite(right?.pitch));
    for (let index = 0; index < notes.length; index += 1) {
      const left = notes[index];
      for (let next = index + 1; next < notes.length; next += 1) {
        const right = notes[next];
        if (noteStart(right) >= noteEnd(left) - EPSILON) break;
        if (mod12(left?.pitch) === mod12(right?.pitch) && Math.round(finite(left?.pitch)) === Math.round(finite(right?.pitch))) {
          collisions += 1;
        }
      }
    }
  }
  return collisions;
}

function leadCollisionCount(song, selection) {
  const targetIds = targetTrackIds(song, selection);
  if (!targetIds.has("melody") && !targetIds.has("counterpoint")) return 0;
  const melody = scopedNotes(song, "melody", selection);
  const counterpoint = scopedNotes(song, "counterpoint", selection);
  let collisions = 0;
  for (const lead of melody) {
    for (const answer of counterpoint) {
      if (Math.round(finite(lead?.pitch)) !== Math.round(finite(answer?.pitch))) continue;
      if (noteStart(lead) < noteEnd(answer) - EPSILON && noteStart(answer) < noteEnd(lead) - EPSILON) {
        collisions += 1;
      }
    }
  }
  return collisions;
}

function collisionMetrics(song, selection) {
  return {
    sameTrack: sameTrackCollisionCount(song, selection),
    leadUnisons: leadCollisionCount(song, selection),
  };
}

function nearestDistance(value, candidates = []) {
  if (!candidates.length) return Infinity;
  return Math.min(...candidates.map((candidate) => Math.abs(value - candidate)));
}

function uniqueAttackStarts(notes = []) {
  return [...new Set(notes.map((note) => round(noteStart(note), 4)))].sort((left, right) => left - right);
}

function kickBassLock(song, selection) {
  if (!targetTrackIds(song, selection).has("bass") && selection.target !== "section" && selection.target !== "song") {
    return { compared: 0, lock: 1 };
  }
  const kicks = scopedNotes(song, "drums", selection)
    .filter((note) => [35, 36].includes(Math.round(finite(note?.pitch))))
    .map(noteStart);
  const bass = scopedNotes(song, "bass", selection).map(noteStart);
  if (!bass.length || !kicks.length) return { compared: 0, lock: 1 };
  const locked = bass.filter((start) => nearestDistance(start, kicks) <= 0.34 + EPSILON).length;
  return { compared: bass.length, lock: locked / bass.length };
}

function conductorPulses(song, id, selection) {
  const conductor = song?.grooveConductor;
  if (!Array.isArray(conductor?.bars) || !conductor.bars.length) return [];
  const ranges = scopeRanges(song, selection);
  const pulses = [];
  const preferredLanes = [grooveLaneForTrack(id)];
  const fallbackLanes = {
    drums: ["anchors", "answers"],
    bass: ["anchors", "answers"],
    chords: ["chordPulses", "anchors"],
    melody: ["anchors", "answers"],
    counterpoint: ["counterPulses", "answers"],
    pad: ["chordPulses", "anchors"],
  }[id] ?? ["anchors", "answers"];
  const hasPreferredLane = conductor.bars.some((bar) => (
    preferredLanes.some((lane) => Array.isArray(bar?.[lane]) && bar[lane].length > 0)
  ));
  const lanes = hasPreferredLane ? preferredLanes : fallbackLanes;

  for (const range of ranges) {
    const firstBar = Math.floor(range.start / range.beatsPerBar);
    const lastBar = Math.floor(Math.max(range.start, range.end - EPSILON) / range.beatsPerBar);
    for (let bar = firstBar; bar <= lastBar; bar += 1) {
      const plan = conductor.bars[bar];
      if (!plan) continue;
      for (const lane of lanes) {
        for (const offset of plan?.[lane] ?? []) {
          const beat = bar * range.beatsPerBar + finite(offset);
          if (beat >= range.start - EPSILON && beat < range.end - EPSILON) pulses.push(beat);
        }
      }
    }
  }
  return [...new Set(pulses.map((beat) => round(beat, 4)))].sort((a, b) => a - b);
}

function conductorAlignment(song, selection) {
  const targetIds = targetTrackIds(song, selection);
  let compared = 0;
  let aligned = 0;
  for (const id of targetIds) {
    const pulses = conductorPulses(song, id, selection);
    if (!pulses.length) continue;
    for (const start of uniqueAttackStarts(scopedNotes(song, id, selection))) {
      compared += 1;
      if (nearestDistance(start, pulses) <= 0.14 + EPSILON) aligned += 1;
    }
  }
  return { compared, alignment: compared ? aligned / compared : 1 };
}

function densityMetrics(song, selection) {
  const targetIds = targetTrackIds(song, selection);
  const ranges = scopeRanges(song, selection);
  const bars = Math.max(1, ranges.reduce((sum, range) => sum + range.bars, 0));
  const byTrack = {};
  let attacks = 0;
  for (const id of targetIds) {
    const count = uniqueAttackStarts(scopedNotes(song, id, selection)).length;
    byTrack[id] = round(count / bars, 3);
    attacks += count;
  }
  return {
    attacks,
    attacksPerBar: attacks / bars,
    byTrack,
    bars,
  };
}

function cadenceMetricForSection(song, range, targetIds, plan = null) {
  if (!plan || plan.cadence !== "resolve") return { required: false, resolved: true, checkedTrackId: null };
  const priority = ["melody", "bass", "counterpoint", "chords"].filter((id) => targetIds.has(id));
  const finalChord = harmonyAt(song, range.end - 0.01);
  const classes = chordClasses(finalChord);
  if (!classes?.size) return { required: false, resolved: true, checkedTrackId: null };

  for (const id of priority) {
    const landing = scopedNotes(song, id, { sectionId: range.section.id })
      .filter((note) => noteStart(note) >= range.end - Math.max(2, range.beatsPerBar / 2) - EPSILON)
      .sort((left, right) => noteStart(left) - noteStart(right))
      .at(-1);
    if (!landing) continue;
    return {
      required: true,
      resolved: classes.has(mod12(landing?.pitch ?? landing?.note ?? landing?.midi)),
      checkedTrackId: id,
      pitch: Math.round(finite(landing?.pitch ?? landing?.note ?? landing?.midi)),
    };
  }
  return { required: true, resolved: false, checkedTrackId: priority[0] ?? null, pitch: null };
}

function cadenceMetrics(song, selection, directive = {}) {
  const targetIds = targetTrackIds(song, selection);
  const ranges = scopeRanges(song, selection);
  let required = 0;
  let resolved = 0;
  const details = [];
  for (const range of ranges) {
    const plan = String(range.section?.id) === String(directive?.sectionPlan?.sectionId)
      ? directive.sectionPlan
      : (song?.songPlan?.sections ?? song?.songPlan?.sectionPlans ?? song?.songBlueprint?.sectionPlans ?? [])
        .find((candidate) => String(candidate?.sectionId ?? candidate?.id) === String(range.section?.id));
    const metric = cadenceMetricForSection(song, range, targetIds, plan);
    if (metric.required) {
      required += 1;
      if (metric.resolved) resolved += 1;
    }
    details.push({ sectionId: String(range.section?.id ?? "song"), ...metric });
  }
  return {
    required,
    resolved,
    fit: required ? resolved / required : 1,
    details,
  };
}

function blueprintMetrics(song, selection, directive = {}) {
  if (selection.sectionId == null) return { expectedTracks: [], missingTracks: [], interlockMismatches: 0 };
  const targetIds = targetTrackIds(song, selection);
  const expectedTracks = [];
  const missingTracks = [];
  const orchestration = directive?.orchestration ?? {};
  for (const id of targetIds) {
    const lanePresence = finite(orchestration?.lanes?.[id]?.presence, NaN);
    const featured = orchestration?.featuredTrack === id || directive?.interlock?.featuredTrack === id;
    const expected = featured || (Number.isFinite(lanePresence) && lanePresence >= 0.35);
    if (!expected) continue;
    expectedTracks.push(id);
    if (scopedNotes(song, id, selection).length === 0) missingTracks.push(id);
  }

  let interlockMismatches = 0;
  const expectedConnectionId = directive?.interlock?.id;
  if (expectedConnectionId) {
    for (const id of targetIds) {
      for (const note of scopedNotes(song, id, selection)) {
        if (note?.connectionId != null && String(note.connectionId) !== String(expectedConnectionId)) {
          interlockMismatches += 1;
        }
      }
    }
  }
  return { expectedTracks, missingTracks, interlockMismatches };
}

function grooveMetrics(song, selection) {
  const kickBass = kickBassLock(song, selection);
  const conductor = conductorAlignment(song, selection);
  const density = densityMetrics(song, selection);
  return { kickBass, conductor, density };
}

function scoreFromRatio(value) {
  return Math.round(clamp(value, 0, 1) * 100);
}

export function analyzeCompositionCandidate(song, selection = {}, directive = {}) {
  const harmony = harmonyMetrics(song, selection);
  const register = registerMetrics(song, selection);
  const collisions = collisionMetrics(song, selection);
  const groove = grooveMetrics(song, selection);
  const cadence = cadenceMetrics(song, selection, directive);
  const blueprint = blueprintMetrics(song, selection, directive);
  const harmonyScore = scoreFromRatio(harmony.chordFit) - Math.min(35, harmony.harshStrongNotes * 12);
  const registerScore = Math.max(0, 100 - register.violations * 25 - Math.round((1 - register.preferredRatio) * 18));
  const grooveScore = Math.round((
    scoreFromRatio(groove.kickBass.lock)
    + scoreFromRatio(groove.conductor.alignment)
  ) / 2);
  const phraseScore = scoreFromRatio(cadence.fit);
  const blueprintScore = Math.max(0, 100 - blueprint.missingTracks.length * 40 - blueprint.interlockMismatches * 20);

  return Object.freeze({
    version: 1,
    harmony: Object.freeze({
      contextualNotes: harmony.contextualNotes,
      chordToneNotes: harmony.chordToneNotes,
      chordFit: round(harmony.chordFit),
      harshStrongNotes: harmony.harshStrongNotes,
    }),
    register: Object.freeze({
      violations: register.violations,
      violationsByTrack: Object.freeze({ ...register.violationsByTrack }),
      preferredRatio: round(register.preferredRatio),
      melodyHealth: register.melodyHealth,
    }),
    collisions: Object.freeze({ ...collisions }),
    groove: Object.freeze({
      kickBass: Object.freeze({
        compared: groove.kickBass.compared,
        lock: round(groove.kickBass.lock),
      }),
      conductor: Object.freeze({
        compared: groove.conductor.compared,
        alignment: round(groove.conductor.alignment),
      }),
      density: Object.freeze({
        attacks: groove.density.attacks,
        attacksPerBar: round(groove.density.attacksPerBar),
        bars: groove.density.bars,
        byTrack: Object.freeze({ ...groove.density.byTrack }),
      }),
    }),
    cadence: Object.freeze({
      required: cadence.required,
      resolved: cadence.resolved,
      fit: round(cadence.fit),
      details: Object.freeze(cadence.details.map((entry) => Object.freeze({ ...entry }))),
    }),
    blueprint: Object.freeze({
      expectedTracks: Object.freeze([...blueprint.expectedTracks]),
      missingTracks: Object.freeze([...blueprint.missingTracks]),
      interlockMismatches: blueprint.interlockMismatches,
    }),
    scores: Object.freeze({
      harmony: clamp(Math.round(harmonyScore), 0, 100),
      groove: clamp(grooveScore, 0, 100),
      register: clamp(registerScore, 0, 100),
      phrase: clamp(phraseScore, 0, 100),
      blueprint: clamp(blueprintScore, 0, 100),
      overall: clamp(Math.round((harmonyScore + grooveScore + registerScore + phraseScore + blueprintScore) / 5), 0, 100),
    }),
  });
}

function pushRegression(hardIssues, warnings, condition, issue, warningOnly = false) {
  if (!condition) return;
  (warningOnly ? warnings : hardIssues).push(issue);
}

export function judgeCompositionCandidate(before, after, selection = {}, directive = {}) {
  const baseline = analyzeCompositionCandidate(before, selection, directive);
  const candidate = analyzeCompositionCandidate(after, selection, directive);
  const hardIssues = [];
  const warnings = [];
  const jazz = compareJazzQuality(before, after, selection);
  hardIssues.push(...(jazz?.hardIssues ?? []));
  warnings.push(...(jazz?.warnings ?? []));

  pushRegression(
    hardIssues,
    warnings,
    candidate.harmony.harshStrongNotes > baseline.harmony.harshStrongNotes,
    "harmony:new-harsh-strong-note",
  );
  pushRegression(
    hardIssues,
    warnings,
    candidate.harmony.contextualNotes >= 3
      && baseline.harmony.contextualNotes >= 3
      && candidate.harmony.chordFit < baseline.harmony.chordFit - 0.18
      && candidate.harmony.chordFit < 0.65,
    "harmony:chord-fit-regression",
  );

  pushRegression(
    hardIssues,
    warnings,
    candidate.register.violations > baseline.register.violations,
    "register:new-role-window-violation",
  );
  pushRegression(
    hardIssues,
    warnings,
    Number.isFinite(candidate.register.melodyHealth)
      && Number.isFinite(baseline.register.melodyHealth)
      && candidate.register.melodyHealth < 55
      && candidate.register.melodyHealth < baseline.register.melodyHealth - 15,
    "register:health-regression",
  );

  pushRegression(
    hardIssues,
    warnings,
    candidate.collisions.sameTrack > baseline.collisions.sameTrack,
    "collision:new-same-track-overlap",
  );
  pushRegression(
    hardIssues,
    warnings,
    candidate.collisions.leadUnisons > baseline.collisions.leadUnisons,
    "collision:new-lead-counterpoint-unison",
  );

  pushRegression(
    hardIssues,
    warnings,
    candidate.groove.kickBass.compared >= 3
      && baseline.groove.kickBass.compared >= 3
      && candidate.groove.kickBass.lock < 0.25
      && candidate.groove.kickBass.lock < baseline.groove.kickBass.lock - 0.25,
    "groove:kick-bass-lock-regression",
  );
  pushRegression(
    hardIssues,
    warnings,
    candidate.groove.conductor.compared >= 4
      && baseline.groove.conductor.compared >= 4
      && candidate.groove.conductor.alignment < 0.25
      && candidate.groove.conductor.alignment < baseline.groove.conductor.alignment - 0.3,
    "groove:conductor-regression",
  );

  const beforeDensity = baseline.groove.density.attacksPerBar;
  const afterDensity = candidate.groove.density.attacksPerBar;
  pushRegression(
    hardIssues,
    warnings,
    baseline.groove.density.attacks >= 4
      && candidate.groove.density.attacks === 0
      && (directive?.sectionPlan?.density ?? 0.5) >= 0.35,
    "phrase:density-collapse",
  );
  pushRegression(
    hardIssues,
    warnings,
    afterDensity > Math.max(24, beforeDensity * 3.5),
    "phrase:density-explosion",
  );

  pushRegression(
    hardIssues,
    warnings,
    candidate.cadence.required > 0
      && baseline.cadence.fit >= 1
      && candidate.cadence.fit < baseline.cadence.fit,
    "phrase:cadence-resolution-lost",
  );
  pushRegression(
    hardIssues,
    warnings,
    candidate.blueprint.missingTracks.length > baseline.blueprint.missingTracks.length,
    "blueprint:required-track-missing",
  );
  pushRegression(
    hardIssues,
    warnings,
    candidate.blueprint.interlockMismatches > baseline.blueprint.interlockMismatches,
    "blueprint:interlock-mismatch",
  );

  pushRegression(
    hardIssues,
    warnings,
    candidate.harmony.chordFit < baseline.harmony.chordFit - 0.08,
    "warning:harmony-soft-regression",
    true,
  );
  pushRegression(
    hardIssues,
    warnings,
    candidate.groove.conductor.alignment < baseline.groove.conductor.alignment - 0.15,
    "warning:groove-soft-regression",
    true,
  );
  pushRegression(
    hardIssues,
    warnings,
    candidate.register.preferredRatio < baseline.register.preferredRatio - 0.18,
    "warning:preferred-register-regression",
    true,
  );

  return Object.freeze({
    version: 1,
    passed: hardIssues.length === 0,
    hardIssues: Object.freeze(hardIssues),
    warnings: Object.freeze(warnings),
    jazz,
    baseline,
    candidate,
    deltas: Object.freeze({
      harmony: candidate.scores.harmony - baseline.scores.harmony,
      groove: candidate.scores.groove - baseline.scores.groove,
      register: candidate.scores.register - baseline.scores.register,
      phrase: candidate.scores.phrase - baseline.scores.phrase,
      blueprint: candidate.scores.blueprint - baseline.scores.blueprint,
      jazz: jazz?.deltas?.overall ?? 0,
      overall: candidate.scores.overall - baseline.scores.overall,
    }),
  });
}
