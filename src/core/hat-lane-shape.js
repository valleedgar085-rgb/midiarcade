import { clampMidiVelocity } from "./note-contract.js";

const HAT_PITCHES = new Set([42, 44, 46]);

/** Mutate only the cloned, explicitly selected hat lane. No RNG, hit creation,
 * kit change, kick/snare edit, global quantization or competing groove critic.
 * A cyclic bar rotation keeps existing microtiming and inter-hit gaps intact.
 */
export function shapeHatLane(entries, range, intent, { start, pitch, velocity, duration, setStart, setVelocity }) {
  const direction = intent.direction.id;
  if (direction === "shiftHats" && intent.preserve.includes("rhythm")) return null;
  const hats = entries.filter((entry) => entry.trackId === "drums" && HAT_PITCHES.has(pitch(entry.note)));
  if (!hats.length) return null;
  const shifted = new Map();
  const amount = { touchUp: 8, reshape: 12, transform: 16 }[intent.size.id] ?? 8;
  for (const entry of hats) {
    const note = entry.note;
    const current = start(note);
    const barStart = Math.floor(current / range.beatsPerBar) * range.beatsPerBar;
    if (direction === "shiftHats") {
      // Refuse a partial/protected cycle rather than changing its hit pattern.
      if (note.preserveTiming || note.grooveAuthorityLock || note.transitionHandoffRole) return null;
      const next = Number((barStart + (current - barStart + 0.25) % range.beatsPerBar).toFixed(6));
      if (next < range.start || next >= range.end || next + duration(note) > range.end + 1e-7) return null;
      shifted.set(entry, next);
    } else {
      const phase = ((current - barStart) % 1 + 1) % 1;
      const change = phase >= 0.35 && phase < 0.85 ? amount : -amount / 2;
      shifted.set(entry, clampMidiVelocity(velocity(note) + change));
    }
  }
  // A selected subset must not rotate onto an unselected hat attack.
  if (direction === "shiftHats") {
    const selected = new Set(hats.map((entry) => entry.note));
    const drums = hats[0].track.notes ?? [];
    for (const next of shifted.values()) {
      if (drums.some((other) => !selected.has(other) && HAT_PITCHES.has(pitch(other))
        && Math.abs(start(other) - next) < 0.001)) return null;
    }
  }
  const changedIds = [];
  for (const [entry, next] of shifted) {
    const before = direction === "shiftHats" ? start(entry.note) : velocity(entry.note);
    if (Math.abs(next - before) < 1e-7) continue;
    if (direction === "shiftHats") setStart(entry.note, next);
    else setVelocity(entry.note, next);
    changedIds.push(`${entry.trackId}:${entry.id}`);
  }
  return changedIds.length ? { changedIds, inserted: 0, deleted: 0 } : null;
}
