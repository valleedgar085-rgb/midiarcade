/**
 * Read-only MIDI bass-head diagnostics. No generated note is modified.
 * Onsets are in BEATS; kick drum notes are GM 35/36, not all drums.
 */
const finite = v => typeof v === "number" && Number.isFinite(v);
const round = (n, digits = 3) => Number(n.toFixed(digits));
const mod = (n, m) => ((n % m) + m) % m;
const getTrack = (song, id) => (song?.tracks ?? []).find(t => t?.id === id);
const start = note => Number(note?.start);
const duration = note => Number(note?.duration);
const sectionBounds = (song, section) => {
  const beatsPerBar = finite(song?.meta?.beatsPerBar) && song.meta.beatsPerBar > 0 ? song.meta.beatsPerBar : 4;
  const from = finite(section?.startBeat) ? section.startBeat : (section?.startBar ?? 0) * beatsPerBar;
  const end = finite(section?.endBeat) ? section.endBeat : from + (section?.bars ?? 1) * beatsPerBar;
  return { from, end, beatsPerBar };
};
function asEvents(notes) {
  return (notes ?? []).filter(n => finite(start(n)) && finite(duration(n)) && duration(n) > 0)
    .slice().sort((a,b) => start(a) - start(b) || a.pitch - b.pitch);
}
function nearestEvent(target, events) {
  if(!events.length) return null;
  let best = null;
  for(const evt of events) {
    const difference = target - start(evt);
    if(best === null || Math.abs(difference) < Math.abs(best.deltaBeat) - 1e-9
      || Math.abs(Math.abs(difference) - Math.abs(best.deltaBeat)) <= 1e-9 && start(evt) < best.atBeat){
      best = {atBeat:start(evt),deltaBeat:difference};
    }
  }
  return best;
}
const median = vals => {
  if(!vals.length) return null;
  const sorted = vals.slice().sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
};

/** Summarizes actual drum and bass notes without introducing a new genre critic. */
export function inspectBassHeadGroove(song, { lockToleranceBeats = 0.075 } = {}) {
  if(!finite(lockToleranceBeats)||lockToleranceBeats<=0||lockToleranceBeats>0.25)
    throw new RangeError("lockToleranceBeats must be >0 and <=0.25");
  const drums = asEvents(getTrack(song,"drums")?.notes).filter(n => [35,36].includes(n.pitch));
  const bass = asEvents(getTrack(song,"bass")?.notes);
  const tempo = finite(song?.meta?.tempo) && song.meta.tempo > 0
    ? song.meta.tempo : finite(song?.bpm) && song.bpm > 0 ? song.bpm : null;
  const beatMs = tempo === null ? null : 60000 / tempo;
  const songSections = Array.isArray(song?.structure) ? song.structure : [];
  const sections = songSections.map((section,index) => {
    const {from,end,beatsPerBar} = sectionBounds(song,section);
    const selected = bass.filter(n => start(n)>=from && start(n)<end);
    const kicks = drums.filter(n => start(n)>=from && start(n)<end);
    const joined = selected.map(n => ({n, nearest:nearestEvent(start(n),kicks)}));
    const locked = joined.filter(x => x.nearest && Math.abs(x.nearest.deltaBeat) <= lockToleranceBeats);
    const offset = joined.filter(x => x.nearest && Math.abs(x.nearest.deltaBeat) > lockToleranceBeats);
    const offGrid = selected.filter(n => {
      const phase = mod(start(n),1);
      return Math.abs(phase) > lockToleranceBeats && Math.abs(phase - 1) > lockToleranceBeats;
    });
    const short = selected.filter(n => duration(n)<0.5);
    const long = selected.filter(n => duration(n)>=1);
    const consecutiveOverlaps = selected.slice(1).filter((n,i) =>
      start(selected[i]) + duration(selected[i]) > start(n) + 0.025).length;
    const offsets = joined.filter(x => x.nearest).map(x => x.nearest.deltaBeat);
    const kickToBass = kicks.filter(k => selected.some(b =>
      Math.abs(start(b)-start(k))<=lockToleranceBeats)).length;
    const gap = [];
    let previous = from;
    for(const n of selected){
      const silence = start(n)-previous;
      if(silence>0.05) gap.push(silence);
      previous=Math.max(previous,start(n)+duration(n));
    }
    if(end-previous>0.05) gap.push(end-previous);
    const pitches = selected.map(n => n.pitch);
    const result = {
      sectionId:String(section.id ?? "section-"+index),
      sectionName:String(section.name ?? section.type ?? "section"),
      bars:round((end-from)/beatsPerBar),
      bassNotes:selected.length,
      kickNotes:kicks.length,
      bassAttacksPerBar:round(selected.length/Math.max(1,(end-from)/beatsPerBar)),
      lockedBassAttacks:locked.length,
      complementaryBassAttacks:offset.length,
      offbeatBassAttacks:offGrid.length,
      shortBassNotes:short.length,
      sustainedBassNotes:long.length,
      adjacentBassOverlaps:consecutiveOverlaps,
      kicksWithBassSupport:kickToBass,
      kicksWithoutBassSupport:kicks.length-kickToBass,
      lockRatio:selected.length ? round(locked.length/selected.length) : null,
      complementaryRatio:selected.length ? round(offset.length/selected.length) : null,
      offbeatRatio:selected.length ? round(offGrid.length/selected.length) : null,
      medianKickBassOffsetBeats:offsets.length?round(median(offsets),4):null,
      medianKickBassOffsetMs:offsets.length && beatMs!==null ? round(median(offsets)*beatMs,2):null,
      longestRestBeats:gap.length?round(Math.max(...gap)):0,
      pitchMin:pitches.length?Math.min(...pitches):null,
      pitchMax:pitches.length?Math.max(...pitches):null,
      // This reports information; a low lock ratio is NOT automatically a bad groove.
      status:selected.length===0?"no-bass":kicks.length===0?"no-kick-reference":"measured",
    };
    return result;
  });
  const totalBass = sections.reduce((v,s)=>v+s.bassNotes,0);
  return {
    version:1,genre:String(song?.meta?.genre ?? song?.genre ?? ""),
    tempo,lockToleranceBeats,kickMidiPitches:[35,36],
    sourceBassNotes:bass.length,sourceKickNotes:drums.length,
    sections,overall:{
      measuredSections:sections.filter(s=>s.status==="measured").length,
      bodyBassNotes:totalBass,
      lockedAttacks:sections.reduce((v,s)=>v+s.lockedBassAttacks,0),
      complementaryAttacks:sections.reduce((v,s)=>v+s.complementaryBassAttacks,0),
      offbeatAttacks:sections.reduce((v,s)=>v+s.offbeatBassAttacks,0),
      adjacentBassOverlaps:sections.reduce((v,s)=>v+s.adjacentBassOverlaps,0),
      maxRestBeats:sections.length ? Math.max(...sections.map(s=>s.longestRestBeats)):0,
    },
    limitations:[
      "Bass lock ratio and offbeat percentage describe MIDI events, not groove preference or danceability.",
      "Nearest within-section kick is a reference, not proof that the bass was intended to follow it.",
      "Generated MIDI does not measure sub-bass loudness, actual Android audio, harmonics or playback artifacts.",
      "Excluded sections and explicit rests may be intentional; never automatically fill silence.",
    ],
  };
}
