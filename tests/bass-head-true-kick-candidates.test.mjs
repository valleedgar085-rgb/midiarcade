import test from "node:test";
import assert from "node:assert/strict";
import { createKickRelativeBassShadowCandidates } from "../scripts/lib/bass-head-true-kick-candidates.mjs";
import { classifyBassKickContext, inspectBassHeadTimingChanges } from "../scripts/lib/bass-head-timing-context.mjs";

function fixture(genre="neoSoul"){
 const kicks=Array.from({length:9},(_,i)=>({id:"kick-"+i,pitch:36,start:i*2,duration:.1,velocity:108}));
 const bass=[];
 for (const bar of [0,4,8,12]){
   bass.push({id:"anchor-"+bar,start:bar,pitch:40,duration:.25,velocity:88,phraseAnchor:true});
   bass.push({id:"response-"+bar,start:bar+2.5,pitch:43,duration:.2,velocity:83});
   bass.push({id:"anticipation-"+bar,start:bar+3.5,pitch:45,duration:.2,velocity:86});
 }
 return {genre,bars:4,meta:{genre,bars:4,tempo:100,beatsPerBar:4,totalBeats:16},
  structure:[{id:"verse-1",name:"verse",startBeat:0,endBeat:8,bars:2},
   {id:"chorus-1",name:"chorus",startBeat:8,endBeat:16,bars:2}],
  harmony:[{start:0,duration:8,degree:0},{start:8,duration:8,degree:4}],
  producerIntent:{scenes:[{sectionId:"verse-1",roles:{bass:"foundation"}},
    {sectionId:"chorus-1",roles:{bass:"foundation"}}]},
  tracks:[
   {id:"drums",notes:[...kicks,{pitch:38,start:3,duration:.1},{pitch:42,start:3.75,duration:.1}]},
   {id:"bass",notes:bass},
   {id:"chords",notes:[{pitch:64,start:0,duration:2,velocity:80}]},
   {id:"melody",notes:[{pitch:72,start:1,duration:.5,velocity:84}]},
  ],
 };
}
const notes=(song,id)=>song.tracks.find(x=>x.id===id).notes;
const opts={kickRelativeShadow:true};

test("explicit opt-in, no fusions, no unrelated genres, and no mutation",()=>{
 assert.deepEqual(createKickRelativeBassShadowCandidates(fixture()),[]);
 assert.deepEqual(createKickRelativeBassShadowCandidates(fixture(),{kickRelativeShadow:false}),[]);
 assert.deepEqual(createKickRelativeBassShadowCandidates(fixture("house"),opts),[]);
 const fused=fixture();fused.secondaryGenre="popRadio";
 assert.deepEqual(createKickRelativeBassShadowCandidates(fused,opts),[]);
 const source=fixture(),before=structuredClone(source);
 createKickRelativeBassShadowCandidates(source,opts);
 assert.deepEqual(source,before);
});
test("true after-kick response and before-kick anticipation are DISTINCT candidates",()=>{
 const source=fixture(),before=structuredClone(source);
 const first=createKickRelativeBassShadowCandidates(source,opts);
 const again=createKickRelativeBassShadowCandidates(source,opts);
 assert.deepEqual(first.map(x=>[x.id,x.changedNotes,x.movement]),[
   ["true-kick-response",2,"response"],["true-kick-anticipation",2,"anticipation"]]);
 assert.deepEqual(first.map(x=>[x.id,x.changedNotes,x.movedOnsets]),again.map(x=>[x.id,x.changedNotes,x.movedOnsets]));
 assert.deepEqual(source,before);
 for(const candidate of first){
   assert.equal(candidate.song.tracks.length,source.tracks.length);
   assert.equal(candidate.changedNotes,2);
   assert.equal(candidate.defaultActivationAllowed,false);
   for(const id of ["drums","chords","melody"])assert.deepEqual(
     notes(candidate.song,id),notes(source,id));
   const baseline=new Map(notes(source,"bass").map(note=>[note.id,note]));
   assert.equal(notes(candidate.song,"bass").length,baseline.size);
   const changes=notes(candidate.song,"bass").filter(n=>n.bassHeadBounceRole);
   assert.equal(changes.length,2);
   for(const note of notes(candidate.song,"bass")){
     const original=baseline.get(note.id);
     assert.ok(original);
     for(const key of ["pitch","duration","velocity"])assert.equal(note[key],original[key]);
     if(original.phraseAnchor)assert.equal(note.start,original.start);
     assert.ok(Math.abs(note.start-original.start)<=.250001);
   }
   const report=inspectBassHeadTimingChanges(source,candidate.song);
   assert.equal(report.status,"measured");
   assert.equal(report.measuredNotes,2);
   assert.ok(report.notes.every(n=>n.proposedKick.role===candidate.movement));
   assert.ok(report.notes.every(n=>n.originalKick.role!==candidate.movement));
   for(const change of changes){
     const classified=classifyBassKickContext(source,change.start);
     assert.equal(classified.role,candidate.movement);
     assert.equal(change.bassHeadBounceRole,"true-kick-"+candidate.movement);
   }
 }
});
test("a protected bass phrase and intentionally resting scene cannot be overwritten",()=>{
 const s=fixture();
 for(const n of notes(s,"bass"))n.preserveTiming=true;
 assert.deepEqual(createKickRelativeBassShadowCandidates(s,opts),[]);
 const rests=fixture();
 rests.producerIntent.scenes.forEach(scene=>scene.roles.bass="rest");
 assert.deepEqual(createKickRelativeBassShadowCandidates(rests,opts),[]);
});
test("harmonic transition and collisions block affected moves; other safe bars may survive",()=>{
 const collision=fixture();
 // Occupy 2.25 with a sustained note: response can't land on it.
 notes(collision,"bass").push({id:"collision",start:2.22,pitch:47,duration:.3,velocity:80});
 const choices=createKickRelativeBassShadowCandidates(collision,opts);
 for(const c of choices){
  assert.ok(notes(c.song,"bass").find(n=>n.id==="collision").start===2.22);
  assert.ok(!notes(c.song,"bass").find(n=>n.id==="response-0").bassHeadBounceRole);
 }
 const harmonic=fixture();
 harmonic.harmony=[{start:0,duration:2.35,degree:0},
 {start:2.35,duration:5.65,degree:5},{start:8,duration:8,degree:4}];
 const changed=createKickRelativeBassShadowCandidates(harmonic,opts);
 for(const c of changed){
  assert.ok(!notes(c.song,"bass").find(n=>n.id==="response-0").bassHeadBounceRole,
  "shift from 2.50 to 2.25 must not cross changed harmony");
 }
});
test("never move a beat-0 downbeat even without a phraseAnchor metadata flag",()=>{
 const song=fixture();
 for(const n of notes(song,"bass"))if(n.id.startsWith("anchor-"))delete n.phraseAnchor;
 const result=createKickRelativeBassShadowCandidates(song,opts);
 assert.ok(result.length);
 for(const c of result)for(const bar of [0,4,8,12])
  assert.equal(notes(c.song,"bass").find(n=>n.id==="anchor-"+bar).start,bar);
});
