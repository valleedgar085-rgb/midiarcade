// Deterministic, opt-in counterpoint response proposal. Does not mutate source tracks.
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const interval = (note) => [num(note.start), num(note.start) + Math.max(0.05, num(note.duration, 0.25))];
const overlaps = (a, b, margin) => {
  const [as, ae] = interval(a);
  const [bs, be] = interval(b);
  return as < be - margin && ae > bs + margin;
};
export function proposeCounterpointResponses(melodyNotes = [], counterpointNotes = [], {
  maxShiftBeats = 0.5,
  stepBeats = 0.125,
  sectionEndBeat = Infinity,
  marginBeats = 0.04,
} = {}) {
  const lead = [...melodyNotes].sort((a,b) => num(a.start)-num(b.start));
  const occupied = [];
  const proposals = [];
  const shiftCap = Math.max(0, num(maxShiftBeats, 0.5));
  const step = Math.max(0.03125, num(stepBeats, 0.125));
  for (const note of counterpointNotes) {
    const source = { ...note };
    const candidateOffsets = [0];
    for (let offset = step; offset <= shiftCap + 1e-8; offset += step) {
      candidateOffsets.push(Number(offset.toFixed(6)));
    }
    const best = candidateOffsets.map((offset) => ({...source, start:num(source.start)+offset}))
      .find((candidate) => interval(candidate)[1] <= sectionEndBeat + 1e-8
        && !lead.some((m) => overlaps(candidate,m,marginBeats))
        && !occupied.some((n) => overlaps(candidate,n,0.01)));
    const accepted = best ?? source;
    occupied.push(accepted);
    proposals.push({original:source, proposed:accepted, changed:Boolean(best && best.start !== source.start), unresolved:!best});
  }
  return {notes:proposals.map((p)=>p.proposed), proposals, changed:proposals.filter((p)=>p.changed).length,
    unresolved:proposals.filter((p)=>p.unresolved).length};
}
