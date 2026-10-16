import test from "node:test";
import assert from "node:assert/strict";
import {
 classifyBassKickContext,inspectBassHeadTimingChanges,
} from "../scripts/lib/bass-head-timing-context.mjs";

function fixture(){
 return {genre:"neoSoul",meta:{tempo:84,beatsPerBar:4},structure:[{id:"verse-1",name:"verse",startBeat:0,endBeat:16}],
  tracks:[
   {id:"drums",notes:[
    {pitch:36,start:2.5,duration:.08},
    {pitch:38,start:3,duration:.08},
    {pitch:36,start:3.5,duration:.08},
    {pitch:42,start:3.75,duration:.08},
   ]},
   {id:"bass",notes:[
    {id:"leading",pitch:40,start:2,duration:.25,velocity:90},
    {id:"a",pitch:43,start:3,duration:.4,velocity:85},
    {id:"later",pitch:45,start:4,duration:.4,velocity:87},
   ]},
   {id:"melody",notes:[{pitch:76,start:3,duration:.5,velocity:81}]}
  ],
 };
}
test("quarter-beat-after-grid shift may actually anticipate NEXT kick",()=>{
 const s=fixture();
 const before=classifyBassKickContext(s,3);
 const after=classifyBassKickContext(s,3.25);
 assert.equal(before.role,"response");
 assert.equal(before.signedOffsetBeats,.5);
 assert.equal(after.role,"anticipation");
 assert.equal(after.signedOffsetBeats,-.25);
 assert.equal(after.nextKickGap,.25);
 assert.equal(classifyBassKickContext(s,3.5).role,"kick-locked");
});
test("kick analysis ignores hats and snares, handles no-kick and distant kick",()=>{
 const s=fixture();
 assert.equal(classifyBassKickContext(s,3.75).role,"response");
 assert.equal(classifyBassKickContext(s,15).role,"independent");
 assert.equal(classifyBassKickContext({tracks:[]},3).role,"unreferenced");
 assert.throws(()=>classifyBassKickContext(s,Infinity),/Invalid onset/);
});
test("context report is read-only, deterministic and honors actual note duration/rest and original sections",()=>{
 const s=fixture(),candidate=structuredClone(s),before=structuredClone(s);
 const moved=candidate.tracks.find(t=>t.id==="bass").notes.find(n=>n.id==="a");
 moved.start=3.25;
 moved.bassHeadBounceRole="kick-answer";
 moved.bassHeadBounceSectionId="verse-1";
 const first=inspectBassHeadTimingChanges(s,candidate),again=inspectBassHeadTimingChanges(s,candidate);
 assert.deepEqual(first,again);
 assert.deepEqual(s,before);
 assert.equal(first.changedNotes,1);
 assert.equal(first.measuredNotes,1);
 assert.equal(first.shiftsTowardUpcomingKick,1);
 assert.equal(first.shiftedIntoResponse,0);
 assert.equal(first.notes[0].shiftBeats,.25);
 assert.equal(first.notes[0].shiftMs,178.57);
 assert.equal(first.notes[0].originalKick.role,"response");
 assert.equal(first.notes[0].proposedKick.role,"anticipation");
 assert.equal(first.notes[0].sectionId,"verse-1");
 assert.equal(first.notes[0].barBeat,3);
 assert.equal(first.notes[0].originalBassSpacing.previousTailGap,.75);
 assert.equal(first.notes[0].noteDurationBeats,.4);
 assert.deepEqual(candidate.tracks.find(t=>t.id==="drums"),before.tracks.find(t=>t.id==="drums"));
});
test("unidentifiable matching notes stay incomplete instead of fabricating context",()=>{
 const s=fixture(),candidate=structuredClone(s);
 const b=candidate.tracks[1].notes[1];
 delete b.id;
 b.pitch=99;
 b.start=3.25;
 b.bassHeadBounceRole="kick-answer";
 const report=inspectBassHeadTimingChanges(s,candidate);
 assert.equal(report.status,"incomplete");
 assert.equal(report.measuredNotes,0);
 assert.deepEqual(report.notes,[{status:"unmatched",pitch:99}]);
});
test("a moved attack without a kick is described without inference about musical quality",()=>{
 const s=fixture(),candidate=structuredClone(s);
 s.tracks[0].notes=[];
 candidate.tracks[0].notes=[];
 candidate.tracks[1].notes[1].start=3.25;
 candidate.tracks[1].notes[1].bassHeadBounceRole="kick-answer";
 const result=inspectBassHeadTimingChanges(s,candidate);
 assert.equal(result.notes[0].originalKick.role,"unreferenced");
 assert.equal(result.notes[0].proposedKick.role,"unreferenced");
 assert.equal(result.shiftsTowardUpcomingKick,0);
});
