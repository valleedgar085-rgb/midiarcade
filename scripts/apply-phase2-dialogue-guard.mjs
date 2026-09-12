import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing ${label} anchor.`);
  source = source.replace(from, to);
}

const helper = `function melodicDialogueMetrics(song) {
  const melody = song?.tracks?.find((track) => track.id === "melody")?.notes ?? [];
  const counterpoint = song?.tracks?.find((track) => track.id === "counterpoint")?.notes ?? [];
  if (!counterpoint.length || !melody.length) {
    return {
      counterpointNotes: counterpoint.length,
      simultaneousRatio: 0,
      underLeadRatio: 0,
    };
  }
  const simultaneous = counterpoint.filter((note) => (
    melody.some((lead) => Math.abs(lead.start - note.start) < 0.00001)
  )).length;
  const underLead = counterpoint.filter((note) => (
    melody.some((lead) => (
      note.start > lead.start - 0.04
      && note.start < lead.start + lead.duration + 0.08
    ))
  )).length;
  return {
    counterpointNotes: counterpoint.length,
    simultaneousRatio: round(simultaneous / counterpoint.length, 4),
    underLeadRatio: round(underLead / counterpoint.length, 4),
  };
}

function evaluateMelodicDialoguePreservation(sourceSong, repairedSong, diagnosis = {}) {
  const thresholds = { simultaneousRatio: 0.1, underLeadRatio: 0.25 };
  const applies = String(diagnosis?.weakestDimension ?? "") === "registerHealth";
  if (!applies || !sourceSong || !repairedSong) {
    return {
      applies,
      preserved: true,
      sourceHealthy: null,
      repairedHealthy: null,
      source: null,
      repaired: null,
      thresholds,
    };
  }
  const sourceMetrics = melodicDialogueMetrics(sourceSong);
  const repairedMetrics = melodicDialogueMetrics(repairedSong);
  const healthy = (metrics) => (
    metrics.simultaneousRatio <= thresholds.simultaneousRatio + 1e-9
    && metrics.underLeadRatio <= thresholds.underLeadRatio + 1e-9
  );
  const sourceHealthy = healthy(sourceMetrics);
  const repairedHealthy = healthy(repairedMetrics);
  return {
    applies,
    // A register-health repair may relocate pitch/register, but it must not turn
    // an already-clean melodic conversation into stacked lead/counterpoint attacks.
    // Other dimensions (notably phrase resolution) retain their own cadence and
    // interlock acceptance contracts instead of being judged by this extra veto.
    preserved: !sourceHealthy || repairedHealthy,
    sourceHealthy,
    repairedHealthy,
    source: sourceMetrics,
    repaired: repairedMetrics,
    thresholds,
  };
}

`;
replaceOnce(
  "export function evaluateRepairAcceptance(\n",
  helper + "export function evaluateRepairAcceptance(\n",
  "dialogue helper insertion",
);

replaceOnce(
  "  { sourceReleasePassed = null, repairedReleasePassed = null } = {},\n) {",
  "  {\n    sourceReleasePassed = null,\n    repairedReleasePassed = null,\n    sourceSong = null,\n    repairedSong = null,\n  } = {},\n) {",
  "repair acceptance options",
);

replaceOnce(
  "  const releasePreserved = sourceReleasePassed !== true || repairedReleasePassed === true;\n  const thresholds = {",
  "  const releasePreserved = sourceReleasePassed !== true || repairedReleasePassed === true;\n  const melodicDialogue = evaluateMelodicDialoguePreservation(sourceSong, repairedSong, diagnosis);\n  const thresholds = {",
  "dialogue preservation evaluation",
);

replaceOnce(
  "  if (!releasePreserved) reasons.push(\"release-gate-regression\");\n  return {",
  "  if (!releasePreserved) reasons.push(\"release-gate-regression\");\n  if (!melodicDialogue.preserved) reasons.push(\"melodic-dialogue-regression\");\n  return {",
  "dialogue regression reason",
);

replaceOnce(
  "    releasePreserved,\n    thresholds,",
  "    releasePreserved,\n    melodicDialoguePreserved: melodicDialogue.preserved,\n    melodicDialogue,\n    thresholds,",
  "dialogue return metadata",
);

replaceOnce(
  "          sourceReleasePassed: candidateReleaseGate(sourceCandidate).passed,\n          repairedReleasePassed: repairedReleaseGate.passed,\n        },",
  "          sourceReleasePassed: candidateReleaseGate(sourceCandidate).passed,\n          repairedReleasePassed: repairedReleaseGate.passed,\n          sourceSong: sourceCandidate.song,\n          repairedSong: candidateSong,\n        },",
  "live repair dialogue context",
);

fs.writeFileSync(path, source);
console.log("Applied Phase 2 register-health melodic dialogue repair acceptance guard.");
