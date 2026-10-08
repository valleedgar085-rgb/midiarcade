import { performance } from "node:perf_hooks";

// Baseline O(N^2)
function baselineCollidingAnswers(answers, foreground) {
  return answers.filter((note) => foreground.some((lead) => Math.abs(lead.start - note.start) < 0.105));
}

// Optimized O(N) sliding window
function findCollidingNotes(answers, foreground, threshold = 0.105) {
  if (!answers.length || !foreground.length) return [];

  let sortedAnswers = answers;
  let sortedFg = foreground;

  for (let i = 1; i < answers.length; i++) {
    if (answers[i].start < answers[i - 1].start) {
      sortedAnswers = [...answers].sort((a, b) => a.start - b.start);
      break;
    }
  }

  for (let i = 1; i < foreground.length; i++) {
    if (foreground[i].start < foreground[i - 1].start) {
      sortedFg = [...foreground].sort((a, b) => a.start - b.start);
      break;
    }
  }

  const collidingAnswers = [];
  let leadIdx = 0;
  const fgLen = sortedFg.length;

  for (let j = 0; j < sortedAnswers.length; j++) {
    const note = sortedAnswers[j];
    const targetMin = note.start - threshold;
    const targetMax = note.start + threshold;

    while (leadIdx < fgLen && sortedFg[leadIdx].start <= targetMin) {
      leadIdx++;
    }

    if (leadIdx < fgLen && sortedFg[leadIdx].start < targetMax) {
      collidingAnswers.push(note);
    }
  }

  if (sortedAnswers !== answers) {
    const collidingSet = new Set(collidingAnswers);
    return answers.filter((note) => collidingSet.has(note));
  }

  return collidingAnswers;
}

function runComparison(label, fgCount, ansCount, iterations) {
  const fg = Array.from({ length: fgCount }, (_, i) => ({ start: i * (16 / fgCount) })).sort((a, b) => a.start - b.start);
  const ans = Array.from({ length: ansCount }, (_, i) => ({ start: i * (16 / ansCount) + 0.05 })).sort((a, b) => a.start - b.start);

  const startBase = performance.now();
  for (let i = 0; i < iterations; i++) {
    baselineCollidingAnswers(ans, fg);
  }
  const durBase = performance.now() - startBase;

  const startOpt = performance.now();
  for (let i = 0; i < iterations; i++) {
    findCollidingNotes(ans, fg);
  }
  const durOpt = performance.now() - startOpt;

  const speedup = (durBase / durOpt).toFixed(2);
  console.log(`--- ${label} (${fgCount} fg x ${ansCount} ans, ${iterations} ops) ---`);
  console.log(`Baseline (O(N^2)): ${durBase.toFixed(3)} ms`);
  console.log(`Optimized (O(N)): ${durOpt.toFixed(3)} ms`);
  console.log(`Speedup: ${speedup}x faster (${((1 - durOpt / durBase) * 100).toFixed(1)}% reduction)\n`);
}

console.log("=== Collision Detection Comparison Benchmark ===\n");
runComparison("Section level", 30, 30, 100000);
runComparison("Large section", 150, 150, 20000);
runComparison("Full song level", 500, 500, 5000);
