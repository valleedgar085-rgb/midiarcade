import { cloneValue } from "./clone-value.js";
import { trackGroovePulses } from "./groove-contract.js";

export const BASS_HEAD_BOUNCE_GENRES = Object.freeze(["funk","neoSoul"]);
export const MAX_BASS_HEAD_BOUNCE_CANDIDATES = 2;
const valid = v => typeof v==="number" && Number.isFinite(v);
const round = n => Math.round((n+Number.EPSILON)*10000)/10000;
const mod = (a,b) => ((a%b)+b)%b;
const sectionAt = (song,beat) => (song?.structure??[]).find(s => beat>=s.startBeat && beat<s.endBeat);
const bassOf = song => song?.tracks?.find(t=>t.id==="bass");
const kicksOf = song => (song?.tracks?.find(t=>t.id==="drums")?.notes??[])
  .filter(n=>[35,36].includes(n.pitch)&&valid(n.start));
const harmonyAt = (song,beat) => (song?.harmony??[]).find(c=>
  valid(c.start)&&valid(c.duration)&&beat>=c.start-1e-6&&beat<c.start+c.duration-1e-6);
const locked = n => Boolean(n?.locked || n?.grooveAuthorityLocked || n?.motifMemoryCore
  || n?.phraseAnchor || n?.motifHandoffRole || n?.transitionHandoffRole
  || n?.ensembleCadenceRole || n?.finalAssemblyRole || n?.bassRegisterRole==="upper-harmonic");
function noOverlap(notes, note, target) {
  const end=target+note.duration;
  return notes.every(other=>other===note || !valid(other.start)||!valid(other.duration)
    || end<=other.start+1e-4 || target>=other.start+other.duration-1e-4);
}
/**
 * Opt-in candidate-only bass bounce. The existing song generator is never
 * modified. Shift one short non-anchor bass onset toward the ORIGINAL bass
 * conductor pulse, not a new random grid. Do not touch drums, sound, pitch,
 * velocity, duration, notes count, harmonic boundaries or scene intent.
 */
export function createBassHeadBounceCandidates(song,{maxCandidates=2}={}){
  const genre=String(song?.meta?.genre??song?.genre??"");
  if(!BASS_HEAD_BOUNCE_GENRES.includes(genre)||song?.meta?.secondaryGenre||song?.secondaryGenre)return [];
  if(!song?.grooveConductor?.bars?.length||!bassOf(song)?.notes?.length)return [];
  const limit=Math.min(MAX_BASS_HEAD_BOUNCE_CANDIDATES,Math.max(0,Math.floor(Number(maxCandidates)||0)));
  if(!limit)return [];
  const beatBar=Math.max(1,Number(song?.meta?.beatsPerBar??4));
  const kicks=kicksOf(song), notes=bassOf(song).notes;
  const candidates=[];
  for(const direction of [1,-1]){
    const changes=[];
    const touchedSections=new Set();
    for(let index=0;index<notes.length;index++){
      const n=notes[index],start=n?.start;
      if(!valid(start)||!valid(n?.duration)||n.duration<0.10||n.duration>0.6
        ||locked(n)||Math.abs(mod(start,1))>0.075 && Math.abs(mod(start,1)-1)>0.075
        ||mod(start,beatBar)<0.45)continue;
      const sec=sectionAt(song,start);
      if(!sec||!["verse","chorus","hook","theme","idea"].some(k=>
        String(sec.name??"").toLowerCase().includes(k)))continue;
      if(touchedSections.has(sec.id)||song?.producerIntent?.scenes?.some(x=>
        x.sectionId===sec.id&&x.roles?.bass==="rest"))continue;
      if(kicks.some(k=>Math.abs(k.start-start)<0.08))continue;
      const target=round(start+direction*0.25);
      if(target<=sec.startBeat+0.5||target+n.duration>=sec.endBeat-0.12
        ||Math.floor(target/beatBar)!==Math.floor(start/beatBar)
        ||kicks.some(k=>Math.abs(k.start-target)<0.08)
        ||!noOverlap(notes,n,target))continue;
      const chord=harmonyAt(song,start);
      if(!chord||harmonyAt(song,target)!==chord
        ||target+n.duration>=chord.start+chord.duration-0.04)continue;
      const groove=trackGroovePulses(song.grooveConductor,"bass",
        Math.floor(start/beatBar)*beatBar,Math.floor(start/beatBar)*beatBar+beatBar,beatBar);
      if(!groove.some(p=>Math.abs(p-target)<=0.075))continue;
      changes.push({index,start,target,sectionId:String(sec.id)});
      touchedSections.add(sec.id);
      if(changes.length>=2)break;
    }
    if(!changes.length)continue;
    const candidate=cloneValue(song);
    const out=bassOf(candidate).notes;
    for(const change of changes){
      out[change.index].start=change.target;
      out[change.index].bassHeadBounceRole=direction>0?"answer":"anticipation";
    }
    const before=notes.filter(n=>Math.abs(mod(n.start,1))>0.075
      &&Math.abs(mod(n.start,1)-1)>0.075).length;
    const after=out.filter(n=>Math.abs(mod(n.start,1))>0.075
      &&Math.abs(mod(n.start,1)-1)>0.075).length;
    if(after<=before)continue;
    candidates.push(Object.freeze({
      id:direction>0?"bass-head-answer":"bass-head-anticipation",
      song:candidate,changedNotes:changes.length,
      changedSections:changes.map(c=>c.sectionId),
      offbeatDelta:after-before,
      maxShiftBeats:0.25,
    }));
    if(candidates.length>=limit)break;
  }
  return candidates;
}
