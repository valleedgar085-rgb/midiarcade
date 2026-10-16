import test from "node:test";
import assert from "node:assert/strict";
import { inspectHookLineage } from "../scripts/lib/hook-lineage-audit.mjs";

const notes=(offset,pitches)=>pitches.map((pitch,index)=>({pitch,start:offset+index,duration:0.5,velocity:75}));
function fixture({mutateReturn=false,wrongMemory=false}={}){
  const a=[60,64,67,69,67,64],b=mutateReturn?[72,65,61,67,60,74]:a;
  return {
    genre:"popRadio",meta:{genre:"popRadio",beatsPerBar:4,keyPc:0,scaleIntervals:[0,2,4,5,7,9,11]},
    structure:[
      {id:"chorus-1",name:"chorus",startBeat:0,endBeat:8},
      {id:"verse-1",name:"verse",startBeat:8,endBeat:16},
      {id:"chorus-2",name:"chorus",startBeat:16,endBeat:24},
    ],
    motifs:{sectionAssignments:[
      {sectionId:"chorus-1",motifId:"B"},{sectionId:"verse-1",motifId:"A"},
      {sectionId:"chorus-2",motifId:"B"},
    ]},
    memoryMap:[{sectionId:"chorus-2",originSectionId:wrongMemory?"verse-1":"chorus-1",relationship:"recall"}],
    phraseMemory:{sections:[{sectionId:"chorus-2",sourceSectionId:"chorus-1",relationship:"recall",recallStrength:0.9}]},
    tracks:[{id:"melody",notes:[...notes(0,a),...notes(16,b)]}],
  };
}
test("lineage shows preserved first-chorus motif, map, phrase and actual note return",()=>{
  const x=fixture();const snap=structuredClone(x);
  const report=inspectHookLineage(x);
  assert.equal(report.sourceMotifId,"B");
  assert.equal(report.returns.length,1);
  assert.equal(report.returns[0].issue,"retained-after-render");
  assert.equal(report.loss.motif,0);
  assert.equal(report.loss.phrase,0);
  assert.deepEqual(x,snap,"source song unchanged");
});
test("lineage distinguishes downstream note identity drift from upstream memory divergence",()=>{
  assert.equal(inspectHookLineage(fixture({mutateReturn:true})).returns[0].issue,"downstream-note-identity-drift");
  assert.equal(inspectHookLineage(fixture({mutateReturn:true,wrongMemory:true})).returns[0].issue,"memory-map-divergence");
});
test("missing chorus and sparse evidence are not fabricated as failed notes",()=>{
  const x=fixture();x.structure=x.structure.slice(0,2);
  const report=inspectHookLineage(x);
  assert.equal(report.returns.length,0);
  assert.equal(report.hookStatus,"unavailable");
});
