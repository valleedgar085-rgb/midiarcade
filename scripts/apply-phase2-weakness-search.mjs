import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");
const original = source;

function replaceExact(before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) {
    if (source.includes(after)) return;
    throw new Error(`Phase 2 weakness-search codemod could not find ${label}`);
  }
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Phase 2 weakness-search codemod found multiple ${label} blocks`);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

replaceExact(
`  const adaptive = input.candidateCount == null && input.adaptiveCandidates !== false;
  const maxCandidateCount = adaptive
`,
`  const adaptive = input.candidateCount == null && input.adaptiveCandidates !== false;
  const weaknessAwareSearch = adaptive && input.weaknessAwareSearch !== false;
  const maxCandidateCount = adaptive
`,
"weakness-aware search flag",
);

replaceExact(
`  return {
    thinkingDepth,
    adaptive,
    baseCandidateCount,
`,
`  return {
    thinkingDepth,
    adaptive,
    weaknessAwareSearch,
    baseCandidateCount,
`,
"search-plan result",
);

replaceExact(
`function candidateReleaseGate(candidate) {
  if (!candidate?.releaseGate) candidate.releaseGate = evaluateSongReleaseGate(candidate?.song, candidate?.evaluation);
  return candidate.releaseGate;
}

/**
 * Map the critic's weakest dimension to the smallest generator dependency
`,
`function candidateReleaseGate(candidate) {
  if (!candidate?.releaseGate) candidate.releaseGate = evaluateSongReleaseGate(candidate?.song, candidate?.evaluation);
  return candidate.releaseGate;
}

function updateCandidateSearchFocus(search, candidates, generation) {
  if (!search?.weaknessAwareSearch || candidates.length < search.baseCandidateCount) return null;
  if (candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, generation))) {
    return search.weaknessFocus ?? null;
  }
  const sourceCandidate = rankCandidates(candidates)[0];
  if (!sourceCandidate) return null;
  const diagnosis = diagnoseCandidateRepair(sourceCandidate.evaluation);
  if (!diagnosis) return null;
  const focus = {
    version: 1,
    ...diagnosis,
    sourceCandidate: sourceCandidate.index,
    observedAfterCandidates: candidates.length,
  };
  search.weaknessFocus = focus;
  const history = Array.isArray(search.weaknessHistory) ? search.weaknessHistory : [];
  const previous = history[history.length - 1];
  if (
    !previous
    || previous.group !== focus.group
    || previous.weakestDimension !== focus.weakestDimension
    || previous.weakestScore !== focus.weakestScore
    || previous.sourceCandidate !== focus.sourceCandidate
  ) {
    history.push(focus);
  }
  search.weaknessHistory = history.slice(-4);
  return focus;
}

/**
 * Map the critic's weakest dimension to the smallest generator dependency
`,
"candidate weakness focus helper",
);

replaceExact(
`    candidateSearch: {
      thinkingDepth: search.thinkingDepth ?? "standard",
      adaptive: Boolean(search.adaptive),
      baseCandidateCount: finite(search.baseCandidateCount, candidates.length),
      maxCandidateCount: finite(search.maxCandidateCount, candidates.length),
      candidatesEvaluated: candidates.length,
      expandedBy: Math.max(0, composedCandidates - finite(search.baseCandidateCount, composedCandidates)),
      targetReached,
    },
`,
`    candidateSearch: {
      thinkingDepth: search.thinkingDepth ?? "standard",
      adaptive: Boolean(search.adaptive),
      weaknessAwareSearch: Boolean(search.weaknessAwareSearch),
      baseCandidateCount: finite(search.baseCandidateCount, candidates.length),
      maxCandidateCount: finite(search.maxCandidateCount, candidates.length),
      candidatesEvaluated: candidates.length,
      expandedBy: Math.max(0, composedCandidates - finite(search.baseCandidateCount, composedCandidates)),
      targetReached,
      focusGroup: search.weaknessFocus?.group ?? null,
      focusDimension: search.weaknessFocus?.weakestDimension ?? null,
      focusRoute: search.weaknessFocus?.route ?? null,
      focusScore: search.weaknessFocus?.weakestScore ?? null,
      focusHistory: clone(search.weaknessHistory ?? []),
    },
`,
"candidate search diagnostics",
);

replaceExact(
`  const composeCandidate = (index) => {
    const seed = candidateSeed(baseSeed, "new", index);
    const config = normalizeConfig({ ...input, seed });
    const routeId = candidateCompositionRoute(baseSeed, index, input.compositionRoute);
`,
`  const composeCandidate = (index, preferredRoute = input.compositionRoute) => {
    const seed = candidateSeed(baseSeed, "new", index);
    const config = normalizeConfig({ ...input, seed });
    const routeId = candidateCompositionRoute(baseSeed, index, preferredRoute);
`,
"new candidate focused route",
);

replaceExact(
`  for (let index = 0; index < search.maxCandidateCount; index += 1) {
    composeCandidate(index);
    if (
      candidates.length >= search.baseCandidateCount
      && (!search.adaptive || candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, "new")))
    ) break;
  }
`,
`  for (let index = 0; index < search.maxCandidateCount; index += 1) {
    const focus = index >= search.baseCandidateCount
      ? updateCandidateSearchFocus(search, candidates, "new")
      : null;
    composeCandidate(index, input.compositionRoute ?? focus?.route ?? null);
    if (candidates.length >= search.baseCandidateCount) {
      const targetReached = candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, "new"));
      if (!search.adaptive || targetReached) break;
      updateCandidateSearchFocus(search, candidates, "new");
    }
  }
`,
"new weakness-aware expansion loop",
);

replaceExact(
`  for (let index = 0; index < search.maxCandidateCount; index += 1) {
    const seed = candidateSeed(baseSeed, "similar", index);
`,
`  for (let index = 0; index < search.maxCandidateCount; index += 1) {
    const focus = index >= search.baseCandidateCount
      ? updateCandidateSearchFocus(search, candidates, "similar")
      : null;
    const seed = candidateSeed(baseSeed, "similar", index);
`,
"similar weakness focus",
);

replaceExact(
`      input.compositionRoute ?? (targetTrack ? current.compositionRoute?.id : null),
`,
`      input.compositionRoute ?? (targetTrack ? current.compositionRoute?.id : focus?.route ?? null),
`,
"similar focused route",
);

replaceExact(
`    if (
      candidates.length >= search.baseCandidateCount
      && (!search.adaptive || candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, "similar")))
    ) break;
`,
`    if (candidates.length >= search.baseCandidateCount) {
      const targetReached = candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, "similar"));
      if (!search.adaptive || targetReached) break;
      updateCandidateSearchFocus(search, candidates, "similar");
    }
`,
"similar weakness-aware expansion loop",
);

if (source === original) {
  console.log("Phase 2 weakness-search codemod: no changes required.");
  process.exit(0);
}

fs.writeFileSync(path, source);
console.log(`Phase 2 weakness-search codemod updated src/music-engine.js (${original.length} -> ${source.length} bytes).`);
