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

function sectionForNote(song, note) {
  const sections = Array.isArray(song?.structure)
    ? song.structure
    : Array.isArray(song?.sections) ? song.sections : [];
  return sections.find((section) => (
    finite(note?.start, 0) >= finite(section?.startBeat, 0) - 1e-6
    && finite(note?.start, 0) < finite(section?.endBeat, 0) - 1e-6
  )) ?? null;
}

function compressVelocitySpreadPreservingSectionMeans(song, notes, targetSpread) {
  const groups = new Map();
  for (const note of notes) {
    const section = sectionForNote(song, note);
    const key = section?.id ?? "__outside-structure__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  }
  if (groups.size < 2) return false;

  const globalMean = average(notes.map((note) => finite(note.velocity, 80)), 80);
  const total = Math.max(1, notes.length);
  let betweenVariance = 0;
  let withinVariance = 0;
  const groupMeans = new Map();

  for (const [key, group] of groups) {
    const mean = average(group.map((note) => finite(note.velocity, globalMean)), globalMean);
    groupMeans.set(key, mean);
    betweenVariance += group.length * ((mean - globalMean) ** 2) / total;
    withinVariance += group.reduce(
      (sum, note) => sum + ((finite(note.velocity, mean) - mean) ** 2),
      0,
    ) / total;
  }

  if (withinVariance <= 1e-9) return false;
  const desiredWithinVariance = Math.max(0, targetSpread ** 2 - betweenVariance);
  const compression = clamp(Math.sqrt(desiredWithinVariance / withinVariance), 0, 1);

  for (const [key, group] of groups) {
    const mean = groupMeans.get(key) ?? globalMean;
    const sourceSum = group.reduce((sum, note) => sum + finite(note.velocity, mean), 0);
    const targetSum = Math.round(clamp(sourceSum, 24 * group.length, 124 * group.length));

    for (const note of group) {
      const current = finite(note.velocity, mean);
      note.velocity = clamp(Math.round(mean + (current - mean) * compression), 24, 124);
      note.performanceRepair = "dynamic-spread-section-preserving";
    }

    let correction = targetSum - group.reduce((sum, note) => sum + finite(note.velocity, mean), 0);
    while (correction !== 0) {
      let changed = false;
      const direction = Math.sign(correction);
      for (const note of group) {
        if (correction === 0) break;
        const next = note.velocity + direction;
        if (next < 24 || next > 124) continue;
        note.velocity = next;
        correction -= direction;
        changed = true;
      }
      if (!changed) break;
    }
  }
  return true;
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
  const sourceVelocities = new Map(notes.map((note) => [note, finite(note.velocity, beforeStats.mean)]));
  const preserveSectionArc = beforeStats.spread > targetSpread + 0.75
    && compressVelocitySpreadPreservingSectionMeans(repaired, notes, targetSpread);

  if (!preserveSectionArc) {
    let index = 0;
    for (const track of pitchedTracks) {
      for (const note of track.notes ?? []) {
        const current = finite(note.velocity, beforeStats.mean);
        const normalized = beforeStats.spread > 0.75
          ? (current - beforeStats.mean) / beforeStats.spread
          : (((index % 5) - 2) / 2);
        note.velocity = clamp(Math.round(beforeStats.mean + normalized * targetSpread), 24, 124);
        note.performanceRepair = "dynamic-spread";
        index += 1;
      }
    }
  }

  let changedNotes = 0;
  let maxVelocityDelta = 0;
  for (const note of notes) {
    const current = sourceVelocities.get(note) ?? beforeStats.mean;
    if (note.velocity !== current) {
      changedNotes += 1;
      maxVelocityDelta = Math.max(maxVelocityDelta, Math.abs(note.velocity - current));
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
    sectionArcPreserved: preserveSectionArc,
    spreadErrorBefore: round(Math.abs(beforeStats.spread - targetSpread), 4),
    spreadErrorAfter: round(Math.abs(afterStats.spread - targetSpread), 4),
  };
}
