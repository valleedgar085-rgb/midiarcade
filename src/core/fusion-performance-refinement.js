import { cloneValue } from "./clone-value.js";
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value, min)));

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + finite(value), 0) / values.length : fallback;
}

function velocitySpread(notes) {
  const velocities = notes.map((note) => finite(note.velocity, 80));
  const mean = average(velocities, 80);
  const variance = average(velocities.map((velocity) => (velocity - mean) ** 2), 0);
  return { mean, spread: Math.sqrt(variance) };
}

/**
 * Mirrors the Producer Brain's deterministic rebalanceRepairPerformance()
 * dynamics operation as a candidate only. The caller must still pass the
 * candidate through the full critic and release gate before it can commit.
 */
export function createFusionPerformanceRebalanceCandidate(song) {
  const repaired = cloneValue(song);
  const profile = cloneValue(repaired?.performanceProfile ?? {});
  profile.timingJitter = Math.min(0.035, Math.abs(finite(profile.timingJitter, 0)));
  profile.trackOffsets = Object.fromEntries(
    Object.entries(profile.trackOffsets ?? {}).map(([id, offset]) => [id, clamp(offset, -0.045, 0.045)]),
  );
  repaired.performanceProfile = profile;

  const pitchedTracks = (repaired.tracks ?? []).filter((track) => track.id !== "drums");
  const notes = pitchedTracks.flatMap((track) => track.notes ?? []);
  if (!notes.length) return null;

  const beforeStats = velocitySpread(notes);
  const targetSpread = clamp(10 + finite(profile.velocityVariance, 5) * 1.2, 8, 28);
  let index = 0;
  let changedNotes = 0;
  let maxVelocityDelta = 0;

  for (const track of pitchedTracks) {
    for (const note of track.notes ?? []) {
      const current = finite(note.velocity, beforeStats.mean);
      const normalized = beforeStats.spread > 0.75
        ? (current - beforeStats.mean) / beforeStats.spread
        : (((index % 5) - 2) / 2);
      const next = clamp(Math.round(beforeStats.mean + normalized * targetSpread), 24, 124);
      if (next !== current) {
        changedNotes += 1;
        maxVelocityDelta = Math.max(maxVelocityDelta, Math.abs(next - current));
      }
      note.velocity = next;
      note.performanceRepair = "dynamic-spread";
      index += 1;
    }
  }

  const afterStats = velocitySpread(pitchedTracks.flatMap((track) => track.notes ?? []));
  repaired.precisionRepair = {
    ...(repaired.precisionRepair ?? {}),
    performance: {
      version: 1,
      spreadBefore: round(beforeStats.spread),
      targetSpread: round(targetSpread),
    },
  };

  return {
    id: "fusion-performance-dynamic-spread",
    song: repaired,
    changedNotes,
    maxVelocityDelta,
    meanVelocityBefore: round(beforeStats.mean, 4),
    meanVelocityAfter: round(afterStats.mean, 4),
    spreadBefore: round(beforeStats.spread, 4),
    spreadAfter: round(afterStats.spread, 4),
    targetSpread: round(targetSpread, 4),
    spreadErrorBefore: round(Math.abs(beforeStats.spread - targetSpread), 4),
    spreadErrorAfter: round(Math.abs(afterStats.spread - targetSpread), 4),
  };
}
