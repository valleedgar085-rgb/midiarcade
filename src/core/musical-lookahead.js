const pc = (pitch) => ((pitch % 12) + 12) % 12;

/** Choose a nearby preparation for a real future chord, without adding notes or moving time. */
export function planMusicalLookahead({
  pitch, start, boundary, totalBeats, scalePitchClasses = [], currentTones = [],
  nextTones = [], trackId = "melody", protectedLanding = false,
} = {}) {
  if (![pitch, start, boundary, totalBeats].every(Number.isFinite)
    || protectedLanding || boundary >= totalBeats - 0.01
    || boundary <= start || boundary - start > 1.5
    || !["bass", "melody", "counterpoint"].includes(trackId)) return null;
  const scale = new Set(scalePitchClasses);
  const future = new Set(nextTones.filter((tone) => scale.has(tone)));
  if (!future.size || !scale.has(pc(pitch))) return null;
  const bass = trackId === "bass";
  const allowed = bass ? scale : new Set(currentTones.filter((tone) => scale.has(tone)));
  if (!allowed.size) return null;
  const goals = [];
  for (let candidate = Math.max(0, pitch - 12); candidate <= Math.min(127, pitch + 12); candidate += 1) {
    if (future.has(pc(candidate))) goals.push(candidate);
  }
  const goalFor = (value) => goals.reduce((best, candidate) => (
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
  ), goals[0]);
  const distance = (value) => Math.abs(goalFor(value) - value);
  const score = (value) => distance(value) + Math.abs(value - pitch) * 0.35;
  let chosen = pitch;
  const limit = bass ? 2 : 4;
  for (let candidate = Math.max(0, pitch - limit); candidate <= Math.min(127, pitch + limit); candidate += 1) {
    // Bass approaches the incoming root by step, rather than stating it early.
    if (!allowed.has(pc(candidate)) || bass && distance(candidate) === 0) continue;
    if (score(candidate) < score(chosen) - 1e-7) chosen = candidate;
  }
  if (chosen === pitch) return null;
  return { pitch: chosen, goalPitch: goalFor(chosen), boundary, role: bass ? "root-approach" : "chord-connection" };
}
