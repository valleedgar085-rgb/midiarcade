/**
 * Read-only attribution of chorus-hook drift to composition stages.
 *
 * Given the melody notes reported after each compose() stage plus the final
 * song, this re-scores every returning chorus with the existing recurrence
 * critic at each stage. It adds no critic, threshold or repair owner and never
 * mutates its inputs.
 */
import { evaluateChorusHookRecurrence } from "../../src/core/chorus-hook-recurrence.js";

export const WEAK_RETURN_SCORE = 0.66;
const round = (value) => Math.round(value * 1000) / 1000;
const DIMENSIONS = ["contour", "interval", "rhythm", "duration", "noteCoverage"];

function stageSong(finalSong, notes) {
  return {
    genre: finalSong.genre,
    meta: finalSong.meta,
    structure: finalSong.structure ?? finalSong.sections,
    tracks: [{ id: "melody", notes }],
  };
}

function comparisonFor(report, sectionId) {
  return (report?.comparisons ?? []).find((entry) => entry.sectionId === sectionId && entry.available) ?? null;
}

function sameNotes(left, right) {
  if (left.length !== right.length) return false;
  const key = (note) => [Number(note.start).toFixed(4), note.pitch, Number(note.duration).toFixed(4)].join("|");
  const a = left.map(key).sort();
  const b = right.map(key).sort();
  return a.every((entry, index) => entry === b[index]);
}

/** Keep only the stages of the last compose() run (a repair may recompose a seed). */
export function lastComposeRun(stages) {
  let first = 0;
  stages.forEach((entry, index) => { if (entry.stage === "generateLead") first = index; });
  return stages.slice(first);
}

/**
 * Snapshots for the composed candidate the committed song derives from: the
 * song itself, or the candidate a critic repair started from.
 */
export function stagesForCommittedSong(song, bySeed) {
  if (bySeed.has(song.seed)) return { stages: lastComposeRun(bySeed.get(song.seed)), finalStage: "commit" };
  const composed = [...bySeed.keys()].filter((key) => key.includes(":new:"));
  const history = song.criticRepair?.acceptanceHistory ?? [];
  // Repair attempt k becomes candidate (composedCount + k - 1); follow it to a composed root.
  let source = song.criticRepair?.sourceCandidate;
  for (let hops = 0; Number.isInteger(source) && hops < 8; hops += 1) {
    const seed = composed.find((key) => key.includes(`:new:${source}:`));
    if (seed) return { stages: lastComposeRun(bySeed.get(seed)), finalStage: "criticRepair+commit" };
    const attempt = source - composed.length + 1;
    const entry = history.find((item) => item.attempt === attempt);
    if (!entry) break;
    source = entry.sourceCandidate;
  }
  return { stages: [], finalStage: "commit" };
}

/**
 * @param {object} finalSong committed song (its final melody is the last stage)
 * @param {{stage:string, notes:object[]}[]} stages ordered compose() snapshots
 * @param {{finalStage?: string}} options label for the step from the last compose
 *   snapshot to the committed song (critic repair and commit-time passes)
 */
export function traceHookStages(finalSong, stages, { finalStage = "finalSong" } = {}) {
  const final = evaluateChorusHookRecurrence(finalSong);
  if (final.status !== "evaluated") {
    return { status: "unavailable", reason: final.reason ?? "hook-not-evaluable", returns: [] };
  }
  const finalMelody = (finalSong.tracks ?? []).find((track) => track?.id === "melody")?.notes ?? [];
  const lastStage = stages[stages.length - 1];
  const timeline = [...stages.map((entry) => ({
    stage: entry.stage, report: evaluateChorusHookRecurrence(stageSong(finalSong, entry.notes)),
  })), { stage: finalStage, report: final }];

  const returns = final.comparisons.filter((entry) => entry.available).map((target) => {
    const steps = timeline.map(({ stage, report }) => {
      const entry = comparisonFor(report, target.sectionId);
      return entry ? { stage, score: entry.score, ...Object.fromEntries(DIMENSIONS.map((key) => [key, entry[key]])) } : null;
    }).filter(Boolean);
    if (steps.length < 2) return { sectionId: target.sectionId, diagnosis: "insufficient-stage-evidence", steps };

    const drops = steps.slice(1).map((step, index) => {
      const previous = steps[index];
      const deltas = Object.fromEntries(DIMENSIONS.map((key) => [key, round(step[key] - previous[key])]));
      const worst = DIMENSIONS.slice().sort((a, b) => deltas[a] - deltas[b])[0];
      return { stage: step.stage, from: previous.stage, delta: round(step.score - previous.score), worstDimension: worst, deltas };
    });
    const raw = steps[0].score;
    const finalScore = steps[steps.length - 1].score;
    const firstWeak = steps.find((step) => step.score < WEAK_RETURN_SCORE) ?? null;
    const biggestDrop = drops.slice().sort((a, b) => a.delta - b.delta)[0];
    let diagnosis = "strong";
    if (finalScore < WEAK_RETURN_SCORE) diagnosis = raw < WEAK_RETURN_SCORE ? "born-weak-at-composition" : "degraded-after-composition";
    return {
      sectionId: target.sectionId,
      sourceSectionId: target.sourceSectionId,
      diagnosis,
      rawScore: raw,
      finalScore,
      firstWeakStage: firstWeak?.stage ?? null,
      biggestDrop: biggestDrop && biggestDrop.delta < 0 ? biggestDrop : null,
      steps,
    };
  });
  return {
    status: "evaluated",
    postSelectionChangedMelody: lastStage ? !sameNotes(lastStage.notes, finalMelody) : null,
    returns,
  };
}

export const STAGE_EFFECT_DELTA = 0.05;

export function summarizeStageTraces(traces) {
  const count = (map, key) => { map[key] = (map[key] ?? 0) + 1; };
  const diagnoses = {}; const firstWeak = {}; const biggestDrop = {}; const worstDimension = {};
  const impact = new Map();
  let returns = 0; let postSelection = 0; let rawTotal = 0; let finalTotal = 0;
  for (const trace of traces) {
    if (trace.status !== "evaluated") continue;
    if (trace.postSelectionChangedMelody) postSelection += 1;
    for (const entry of trace.returns) {
      returns += 1;
      count(diagnoses, entry.diagnosis);
      if (entry.rawScore !== undefined) { rawTotal += entry.rawScore; finalTotal += entry.finalScore; }
      if (entry.diagnosis === "degraded-after-composition") {
        count(firstWeak, entry.firstWeakStage);
        if (entry.biggestDrop) { count(biggestDrop, entry.biggestDrop.stage); count(worstDimension, entry.biggestDrop.worstDimension); }
      }
      for (let index = 1; index < (entry.steps ?? []).length; index += 1) {
        const stage = entry.steps[index].stage;
        const delta = entry.steps[index].score - entry.steps[index - 1].score;
        const row = impact.get(stage) ?? { stage, returns: 0, total: 0, harmed: 0, helped: 0 };
        row.returns += 1; row.total += delta;
        if (delta <= -STAGE_EFFECT_DELTA) row.harmed += 1;
        if (delta >= STAGE_EFFECT_DELTA) row.helped += 1;
        impact.set(stage, row);
      }
    }
  }
  const ranked = (map) => Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, songs]) => ({ name, count: songs }));
  return {
    returns, diagnoses, postSelectionChangedSongs: postSelection,
    meanRawScore: returns ? round(rawTotal / returns) : null,
    meanFinalScore: returns ? round(finalTotal / returns) : null,
    firstWeakStage: ranked(firstWeak), biggestDropStage: ranked(biggestDrop), biggestDropDimension: ranked(worstDimension),
    stageImpact: [...impact.values()].map((row) => ({
      stage: row.stage, returns: row.returns, meanDelta: round(row.total / row.returns), harmed: row.harmed, helped: row.helped,
    })).filter((row) => row.harmed || row.helped).sort((a, b) => a.meanDelta - b.meanDelta),
  };
}
