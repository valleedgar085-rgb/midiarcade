import assert from "node:assert/strict";
import test from "node:test";

import {
  rankVoiceLeadingCandidates,
  scoreVoiceLeadingCandidate,
  selectVoiceLeadingCandidate,
  voiceLeadingMetrics,
} from "../src/core/voice-leading-authority.js";

test("voice-leading authority prefers the closest inversion across a simple C-F-G sequence", () => {
  const c = [60, 64, 67];
  const fCandidates = [
    [53, 57, 60],
    [57, 60, 65],
    [60, 65, 69],
  ];
  const f = selectVoiceLeadingCandidate(fCandidates, c, { targetCenter: 62 });
  assert.deepEqual(f, [60, 65, 69]);

  const gCandidates = [
    [55, 59, 62],
    [59, 62, 67],
    [62, 67, 71],
  ];
  const g = selectVoiceLeadingCandidate(gCandidates, f, { targetCenter: 62 });
  assert.deepEqual(g, [59, 62, 67]);
});

test("large inner-voice leaps are penalized even when the top voice stays close", () => {
  const previous = [48, 55, 60, 64];
  const smooth = [50, 55, 59, 64];
  const awkward = [38, 67, 71, 64].sort((a, b) => a - b);

  assert.ok(
    scoreVoiceLeadingCandidate(smooth, previous, { targetCenter: 56 })
      < scoreVoiceLeadingCandidate(awkward, previous, { targetCenter: 56 }),
  );
});

test("retained common tones improve the score", () => {
  const previous = [60, 64, 67, 71];
  const commonToneCandidate = [59, 64, 67, 72];
  const noCommonToneCandidate = [59, 63, 66, 72];

  assert.ok(
    scoreVoiceLeadingCandidate(commonToneCandidate, previous, { targetCenter: 65 })
      < scoreVoiceLeadingCandidate(noCommonToneCandidate, previous, { targetCenter: 65 }),
  );
});

test("voice alignment handles changing voice counts without exploding motion", () => {
  const metrics = voiceLeadingMetrics([55, 60, 64], [52, 55, 60, 64]);
  assert.equal(metrics.voiceCount, 3);
  assert.equal(metrics.previousVoiceCount, 4);
  assert.ok(metrics.maxMotion <= 5, JSON.stringify(metrics));
});

test("candidate ranking is deterministic and independent of candidate order", () => {
  const previous = [60, 64, 67];
  const candidates = [
    [64, 67, 72],
    [59, 62, 67],
    [60, 65, 69],
  ];

  const forward = rankVoiceLeadingCandidates(candidates, previous, { targetCenter: 64 });
  const reverse = rankVoiceLeadingCandidates([...candidates].reverse(), previous, { targetCenter: 64 });

  assert.deepEqual(
    forward.map((entry) => entry.pitches),
    reverse.map((entry) => entry.pitches),
  );
});

test("without a previous voicing, register center selects the starting position", () => {
  const candidates = [
    [48, 52, 55],
    [60, 64, 67],
    [72, 76, 79],
  ];
  const chosen = selectVoiceLeadingCandidate(candidates, [], { targetCenter: 64 });
  assert.deepEqual(chosen, [60, 64, 67]);
});


test("null previous voicing is treated as the start of a sequence", () => {
  const candidates = [
    [48, 52, 55],
    [60, 64, 67],
  ];
  assert.deepEqual(
    selectVoiceLeadingCandidate(candidates, null, { targetCenter: 64 }),
    [60, 64, 67],
  );
});
