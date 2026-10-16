/**
 * Developer-only Bass Head shadow candidates: actual kick response or
 * anticipation, not generic quarter-grid onset shifts.
 *
 * Deliberately NOT imported by production music generation, UI or Web Audio.
 * The original generated song remains authoritative. Candidate generation
 * is opt-in and evaluation/listening belongs to the existing critic/release
 * workflow; this module cannot commit a musical decision.
 */
import { cloneValue } from "../../src/core/clone-value.js";
import { classifyBassKickContext } from "./bass-head-timing-context.mjs";

const VALID_GENRES=new Set(["neoSoul","funk"]);
const KICK_PITCHES=new Set([35,36]);
const MAX_SHIFT=.25;
const MAX_CANDIDATES=2;
const round=v=>Math.round(v*10000)/10000;
const valid=x=>typeof x==="number"&&Number.isFinite(x);
const start=note=>note?.start;
const duration=note=>note?.duration;
const track=(song,id)=>(song?.tracks??[]).find(t=>t?.id===id);
const mod=(x,m)=>((x%m)+m)%m;
const protectedNote=note=>Boolean(
 note?.phraseAnchor||note?.motifMemoryCore||note?.ensembleCadenceRole
 ||note?.motifHandoffRole||note?.transitionHandoffRole||note?.preserveTiming
 ||note?.bassCadenceRole||note?.grooveAuthorityLock
 ||note?.bassRegisterRole==="upper-harmonic"
 ||note?.bassHeadBounceRole
);
function sectionAt(song,beat){
 return (song?.structure??[]).find(s=>valid(s?.startBeat)&&valid(s?.endBeat)
  &&beat>=s.startBeat&&beat<s.endBeat)??null;
}
function sectionAllowsBass(song,section){
 if(!section||!/^(verse|chorus|idea|hook)/i.test(String(section.name??section.type??"")))return false;
 const id=String(section.id??"");
 const scene=song?.producerIntent?.scenes?.find(s=>String(s?.sectionId)===id);
 if(scene?.roles?.bass==="rest")return false;
 const lane=song?.orchestrationMatrix?.find(s=>String(s.sectionId)===id)?.lanes?.bass;
 return !(valid(lane?.presence)&&lane.presence<.42);
}
function harmonicChordAt(song,beat){
 const events=Array.isArray(song?.harmony)?song.harmony:[];
 if(!events.length)return null;
 let selected=null;
 for(let i=0;i<events.length;i++){
  const event=events[i];
  const at=event?.start??event?.startBeat;
  if(valid(at)&&at<=beat+1e-8&&(!selected||at>=selected.at))
    selected={index:i,at};
 }
 return selected?.index??null;
}
function noNewBassOverlap(notes,moving,target){
 const d=duration(moving);
 if(!valid(d)||d<=0)return false;
 return notes.every(note=>{
  if(note===moving)return true;
  const otherStart=start(note),otherEnd=otherStart+duration(note);
  if(!valid(otherStart)||!valid(duration(note)))return false;
  return target>=otherEnd+.02||target+d+.02<=otherStart;
 });
}
function moveIsSafe(song,notes,note,target,kicks,bpb){
 const at=start(note),length=duration(note);
 if(!valid(at)||!valid(length)||length<=0||!valid(target))return false;
 if(Math.abs(at-target)<.0750001||Math.abs(at-target)>MAX_SHIFT+.000001)return false;
 if(mod(at,bpb)<.075||bpb-mod(at,bpb)<.075)return false;
 const section=sectionAt(song,at);
 if(!sectionAllowsBass(song,section))return false;
 if(target<section.startBeat+.65||target+length>section.endBeat-.15)return false;
 if(target>=section.endBeat||sectionAt(song,target)!==section)return false;
 if(Math.floor((at+.000001)/bpb)!==Math.floor((target+.000001)/bpb))return false;
 if(kicks.some(k=>Math.abs(k-at)<=.075||Math.abs(k-target)<=.075))return false;
 if(harmonicChordAt(song,at)!==harmonicChordAt(song,target))return false;
 // A note's release must also remain on its existing chord, rather than
 // smearing across a newly encountered harmony change.
 if(harmonicChordAt(song,at+length-.00001)!==harmonicChordAt(song,target+length-.00001))return false;
 if(!noNewBassOverlap(notes,note,target))return false;
 return true;
}
function optionFor(song,role){
 const out=cloneValue(song);
 const bass=track(out,"bass")?.notes;
 const drums=track(out,"drums")?.notes;
 if(!Array.isArray(bass)||!Array.isArray(drums)||!bass.length)return null;
 const kicks=drums.filter(n=>KICK_PITCHES.has(n.pitch)&&valid(start(n)))
   .map(start).sort((a,b)=>a-b);
 if(!kicks.length)return null;
 const beatsPerBar=valid(song?.meta?.beatsPerBar)&&song.meta.beatsPerBar>0
  ?song.meta.beatsPerBar:4;
 const expected=role==="response"?"response":"anticipation";
 const desireds=kicks.map(k=>round(k+(expected==="response"?.25:-.25)))
  .filter(t=>t>=0);
 const opportunities=[];
 for(const note of bass){
  const original=start(note);
  if(!valid(original)||!valid(duration(note))||protectedNote(note))continue;
  if(kicks.some(k=>Math.abs(k-original)<=.075))continue;
  const options=desireds
   .filter(t=>moveIsSafe(out,bass,note,t,kicks,beatsPerBar))
   .filter(t=>classifyBassKickContext(out,t).role===expected)
   .map(t=>({desired:t,shift:Math.abs(t-original)}))
   .sort((a,b)=>a.shift-b.shift||a.desired-b.desired);
  if(options.length){
   const group=Math.floor(original/(beatsPerBar*2));
   opportunities.push({note,group,at:original,desired:options[0].desired,shift:options[0].shift});
  }
 }
 opportunities.sort((a,b)=>a.shift-b.shift||a.at-b.at||a.desired-b.desired);
 const maxChanges=Math.min(8,Math.max(1,Math.ceil(Number(song?.meta?.bars??song?.bars??4)/2)));
 const used=new Set(),moves=[];
 for(const proposal of opportunities){
  if(moves.length>=maxChanges)break;
  if(used.has(proposal.group))continue;
  if(!moveIsSafe(out,bass,proposal.note,proposal.desired,kicks,beatsPerBar))continue;
  used.add(proposal.group);
  proposal.note.start=proposal.desired;
  proposal.note.bassHeadBounceRole="true-kick-"+expected;
  proposal.note.bassHeadBounceSectionId=String(sectionAt(out,proposal.desired)?.id??"");
  moves.push({from:round(proposal.at),to:round(proposal.desired),
    delta:round(proposal.desired-proposal.at),
    sourceId:proposal.note.id??null,
    nearestKickBeat:classifyBassKickContext(out,proposal.desired).nearestKickBeat});
 }
 if(!moves.length)return null;
 bass.sort((a,b)=>start(a)-start(b)||a.pitch-b.pitch);
 return Object.freeze({
  id:"true-kick-"+expected,movement:expected,changedNotes:moves.length,
  movedOnsets:moves,maxShiftBeats:MAX_SHIFT,defaultActivationAllowed:false,
  song:out,
 });
}
/**
 * Cap two deterministic proposals: a real post-kick response and a real
 * pre-kick anticipation. Production remains unchanged when not called.
 */
export function createKickRelativeBassShadowCandidates(song,config={}){
 if(config?.kickRelativeShadow!==true)return [];
 const genre=String(song?.meta?.genre??song?.genre??"");
 if(!VALID_GENRES.has(genre)||song?.secondaryGenre||song?.meta?.secondaryGenre)return [];
 return ["response","anticipation"].map(role=>optionFor(song,role))
   .filter(Boolean).slice(0,MAX_CANDIDATES);
}
