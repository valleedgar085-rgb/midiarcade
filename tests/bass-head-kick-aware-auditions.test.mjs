import test from "node:test";
import assert from "node:assert/strict";
import {
 inspectBassHeadCandidateRoles,planKickAwareBassAuditions,
} from "../scripts/lib/bass-head-kick-aware-auditions.mjs";

function song(kicks=[2.5,3.5]){
 return {genre:"neoSoul",meta:{genre:"neoSoul",tempo:84,beatsPerBar:4},
  structure:[{id:"verse",name:"verse",startBeat:0,endBeat:16}],
  tracks:[
   {id:"drums",notes:kicks.map(start=>({pitch:36,start,duration:.08}))},
   {id:"bass",notes:[{id:"x",pitch:40,start:3,duration:.2,velocity:80}]},
   {id:"melody",notes:[{pitch:76,start:3,duration:.4}]},
  ]};
}
function move(source,to){
 const proposed=structuredClone(source);
 proposed.tracks[1].notes[0].start=to;
 proposed.tracks[1].notes[0].bassHeadBounceRole="kick-answer";
 return proposed;
}
test("phase 5 remains disabled by default and does not touch source",()=>{
 const original=song(),before=structuredClone(original);
 assert.deepEqual(planKickAwareBassAuditions(original),{
  baseline:"original",defaultActivationAllowed:false,
  candidates:[],rejected:[],experimentalOnly:true});
 assert.deepEqual(original,before);
});
test("label kick-answer cannot misrepresent anticipation of next actual kick",()=>{
 const original=song();
 const report=inspectBassHeadCandidateRoles(original,move(original,3.25));
 assert.equal(report.changedNotes,1);
 assert.equal(report.counts.anticipation,1);
 assert.equal(report.counts.response,0);
 assert.equal(report.roles[0],"anticipation");
});
test("actual post-kick response is distinct from pre-kick anticipation",()=>{
 const original=song([2.75,4]);
 const report=inspectBassHeadCandidateRoles(original,move(original,3.25));
 assert.equal(report.roles[0],"tighter-response");
 assert.equal(report.counts.anticipation,0);
 assert.equal(report.counts.response,0);
});
test("unmatched notes cannot be called a musical improvement",()=>{
 const original=song(),proposed=move(original,3.25);
 proposed.tracks[1].notes[0].pitch=50;
 const report=inspectBassHeadCandidateRoles(original,proposed);
 assert.equal(report.status,"incomplete");
 assert.equal(report.counts.unmatched,1);
});
test("no actual kicks produces unreferenced events, not fabricated response",()=>{
 const original=song([]);
 const report=inspectBassHeadCandidateRoles(original,move(original,3.25));
 assert.equal(report.roles[0],"other");
 assert.equal(report.counts.response,0);
 assert.equal(report.counts.anticipation,0);
});
