/**
 * Read-only Bass Head timing-context analysis.
 *
 * A quarter-beat shift after a grid beat can be BEFORE the following kick,
 * so classify by actual kick MIDI onsets instead of a generic "answer" name.
 * This module never commits notes, changes MIDI, or estimates audio loudness.
 */
const round=(value,digits=3)=>Number(value.toFixed(digits));
const valid=x=>typeof x==="number"&&Number.isFinite(x);
const track=(song,id)=>(song?.tracks??[]).find(x=>x?.id===id);
const onset=note=>Number(note?.start);
const duration=note=>Math.max(0,Number(note?.duration)||0);
const pos=(value,modulus)=>((value%modulus)+modulus)%modulus;

export function classifyBassKickContext(song,beat,{tolerance=.075,maxDistance=1.5}={}){
 if(!valid(beat)||!valid(tolerance)||tolerance<0||tolerance>.25)
   throw new RangeError("Invalid onset or kick tolerance");
 const kicks=(track(song,"drums")?.notes??[])
   .filter(n=>[35,36].includes(n?.pitch)&&valid(n?.start))
   .map(n=>n.start).sort((a,b)=>a-b);
 if(!kicks.length)return {role:"unreferenced",nearestKickBeat:null,signedOffsetBeats:null,priorKickGap:null,nextKickGap:null};
 const previous=kicks.filter(k=>k<=beat).at(-1);
 const following=kicks.find(k=>k>=beat);
 const nearest=kicks.reduce((best,k)=>Math.abs(k-beat)<Math.abs(best-beat)?k:best,kicks[0]);
 const distance=round(beat-nearest,4);
 const priorGap=previous===undefined?null:round(beat-previous,4);
 const nextGap=following===undefined?null:round(following-beat,4);
 let role="independent";
 if(Math.abs(distance)<=tolerance)role="kick-locked";
 else if(Math.abs(distance)<=maxDistance){
   role=distance<0?"anticipation":"response";
 }
 return {role,nearestKickBeat:round(nearest,4),signedOffsetBeats:distance,
   priorKickGap:priorGap,nextKickGap:nextGap};
}

function comparable(before,after){
 return before?.pitch===after?.pitch
   &&duration(before)===duration(after)
   &&(before?.velocity??null)===(after?.velocity??null)
   &&Math.abs(onset(before)-onset(after))<=.250001;
}
function matchOriginal(original,changed){
 const byId=original.filter(n=>changed?.id!=null&&n.id===changed.id&&comparable(n,changed));
 if(byId.length===1)return byId[0];
 const same=original.filter(n=>comparable(n,changed));
 if(same.length===1)return same[0];
 // Identical notes are ambiguous when there is no stable identity. Never
 // make a musical judgment using a guessed note correspondence.
 return null;
}
function neighborGaps(notes,orig){
 const sorted=notes.slice().sort((a,b)=>onset(a)-onset(b));
 const i=sorted.indexOf(orig);
 if(i<0)return {previousTailGap:null,nextAttackGap:null};
 const previous=sorted[i-1],next=sorted[i+1];
 return {
   previousTailGap:previous?round(onset(orig)-(onset(previous)+duration(previous)),4):null,
   nextAttackGap:next?round(onset(next)-(onset(orig)+duration(orig)),4):null,
 };
}
function sectionAt(song,beat){
 return (song?.structure??[]).find(s=>valid(s.startBeat)&&valid(s.endBeat)
   &&beat>=s.startBeat&&beat<s.endBeat)??null;
}
/**
 * Explain the musical context of every annotated onset shift in the existing
 * opt-in Groove Pocket proposal. Never compare or mutate unrelated tracks.
 */
export function inspectBassHeadTimingChanges(originalSong,proposedSong){
 const original=track(originalSong,"bass")?.notes??[];
 const next=track(proposedSong,"bass")?.notes??[];
 const tempo=originalSong?.meta?.tempo??originalSong?.bpm??null;
 const beatMs=valid(tempo)&&tempo>0?60000/tempo:null;
 const beatsPerBar=originalSong?.meta?.beatsPerBar??4;
 if(!valid(beatsPerBar)||beatsPerBar<=0)throw new RangeError("Invalid beats per bar");
 const reports=[];
 for(const note of next.filter(n=>n?.bassHeadBounceRole)){
   const before=matchOriginal(original,note);
   if(!before){
     reports.push({status:"unmatched",pitch:note.pitch});
     continue;
   }
   const oldBeat=onset(before),newBeat=onset(note),shift=round(newBeat-oldBeat,4);
   const originalKick=classifyBassKickContext(originalSong,oldBeat);
   const proposedKick=classifyBassKickContext(originalSong,newBeat);
   const bounds=sectionAt(originalSong,oldBeat);
   reports.push({
     status:"measured",pitch:note.pitch,
     sectionId:String(bounds?.id??"unassigned"),
     barIndex:Math.floor(oldBeat/beatsPerBar)+1,
     barBeat:round(pos(oldBeat,beatsPerBar),4),
     fromBeat:round(oldBeat,4),toBeat:round(newBeat,4),
     shiftBeats:shift,shiftMs:beatMs===null?null:round(shift*beatMs,2),
     originalKick,proposedKick,
     originalBassSpacing:neighborGaps(original,before),
     noteDurationBeats:round(duration(before),4),
     declaredRole:note.bassHeadBounceRole,
   });
 }
 const measured=reports.filter(x=>x.status==="measured");
 return {
   status:reports.some(x=>x.status==="unmatched")?"incomplete":"measured",
   changedNotes:reports.length,measuredNotes:measured.length,
   shiftsTowardUpcomingKick:measured.filter(x=>
     x.proposedKick.role==="anticipation"
     && x.originalKick.role!=="anticipation").length,
   shiftedIntoResponse:measured.filter(x=>
     x.proposedKick.role==="response"
     && x.originalKick.role!=="response").length,
   notes:reports,
   interpretation:"Descriptions of kick/bass onset relationships, NOT musical preference predictions",
 };
}
