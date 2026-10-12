// Deterministic, opt-in timing proposals for *actual* critic conflicts.
// Consonant overlapping phrases are allowed; the source melody is never edited.
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const end = (note) => finite(note.start) + Math.max(0.05, finite(note.duration, 0.25));
const dissonant = (a, b) => {
  const interval = Math.abs(Math.round(finite(a.pitch)) - Math.round(finite(b.pitch))) % 12;
  return [0, 1, 6, 11].includes(interval);
};
const sustainedOverlap = (a, b) => finite(a.start) < end(b) && finite(b.start) < end(a);
function violations(note, leads) {
  const onset = leads.some((lead) => Math.abs(finite(note.start) - finite(lead.start)) < 0.12);
  const dissonance = leads.some((lead) => sustainedOverlap(note, lead) && dissonant(note, lead));
  return Number(onset) + Number(dissonance);
}
function sameVoiceOverlap(a, b) {
  return finite(a.pitch) === finite(b.pitch) && sustainedOverlap(a, b);
}

export function proposeCounterpointResponses(melodyNotes = [], counterpointNotes = [], {
  maxShiftBeats = 0.5,
  stepBeats = 0.125,
  sectionStartBeat = 0,
  sectionEndBeat = Infinity,
} = {}) {
  const lead = [...melodyNotes].sort((a, b) => finite(a.start) - finite(b.start));
  const counter = counterpointNotes.map((note) => ({ ...note }));
  const proposals = [];
  const shiftCap = Math.max(0, finite(maxShiftBeats, 0.5));
  const step = Math.max(0.03125, finite(stepBeats, 0.125));
  const offsets = [0];
  for (let n = 1; n * step <= shiftCap + 1e-8; n += 1) {
    const shift = Number((n * step).toFixed(6));
    offsets.push(shift, -shift);
  }

  for (let index = 0; index < counter.length; index += 1) {
    const source = counter[index];
    const initialViolations = violations(source, lead);
    const otherNotes = counter.filter((_, otherIndex) => index !== otherIndex);
    let best = source;
    let bestViolations = initialViolations;

    if (initialViolations > 0) {
      for (const offset of offsets.slice(1)) {
        const candidate = { ...source, start: Number((finite(source.start) + offset).toFixed(6)) };
        if (candidate.start < sectionStartBeat - 1e-8 || end(candidate) > sectionEndBeat + 1e-8) continue;
        if (otherNotes.some((note) => sameVoiceOverlap(candidate, note))) continue;
        const count = violations(candidate, lead);
        if (count < bestViolations) {
          best = candidate;
          bestViolations = count;
        }
        if (bestViolations === 0) break;
      }
    }
    // A successful local proposal is not committed until the whole-song
    // critic, release gate, and groove/coherence audit accept its candidate.
    counter[index] = best;
    proposals.push({
      original: source,
      proposed: best,
      changed: best !== source,
      unresolved: initialViolations > 0 && bestViolations >= initialViolations,
      beforeViolations: initialViolations,
      afterViolations: bestViolations,
    });
  }
  return {
    notes: counter,
    proposals,
    changed: proposals.filter((entry) => entry.changed).length,
    unresolved: proposals.filter((entry) => entry.unresolved).length,
  };
}
