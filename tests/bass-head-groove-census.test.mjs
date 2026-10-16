import assert from "node:assert/strict";
import test from "node:test";
import { inspectBassHeadGroove } from "../scripts/lib/bass-head-groove-census.mjs";

function fixture(){
  return {
    genre:"funk",meta:{genre:"funk",tempo:120,beatsPerBar:4},
    structure:[
      {id:"verse-1",name:"verse",startBeat:0,endBeat:8,bars:2},
      {id:"chorus-1",name:"chorus",startBeat:8,endBeat:16,bars:2},
    ],
    tracks:[
      {id:"drums",notes:[
        {pitch:36,start:0,duration:0.1},{pitch:38,start:1.5,duration:0.1},
        {pitch:36,start:2,duration:0.1},{pitch:42,start:3.5,duration:0.1},
        {pitch:36,start:8,duration:0.1},{pitch:36,start:10,duration:0.1},
      ]},
      {id:"bass",notes:[
        {pitch:40,start:0,duration:0.5},
        {pitch:47,start:1.5,duration:0.25},
        {pitch:40,start:2.04,duration:0.4},
        {pitch:40,start:8.25,duration:1.25},
        {pitch:47,start:9.25,duration:0.3},
        {pitch:43,start:10,duration:0.5},
      ]},
    ],
  };
}
test("Bass Head separates kick-locked from complementary offbeats, ignoring snare and hat",()=>{
  const song=fixture(),before=structuredClone(song);
  const r=inspectBassHeadGroove(song);
  assert.deepEqual(song,before);
  assert.equal(r.sourceKickNotes,4);
  assert.equal(r.sourceBassNotes,6);
  assert.equal(r.sections[0].bassNotes,3);
  assert.equal(r.sections[0].lockedBassAttacks,2);
  assert.equal(r.sections[0].complementaryBassAttacks,1);
  assert.equal(r.sections[0].offbeatBassAttacks,1);
  assert.equal(r.sections[0].kickNotes,2);
  assert.equal(r.sections[0].kicksWithBassSupport,2);
  assert.equal(r.sections[0].lockRatio,0.667);
});
test("Bass Head reports note length, overlaps, exact beat-to-ms conversions and rests",()=>{
  const r=inspectBassHeadGroove(fixture());
  const s=r.sections[1];
  assert.equal(s.sustainedBassNotes,1);
  assert.equal(s.adjacentBassOverlaps,1);
  assert.equal(s.offbeatBassAttacks,2);
  assert.equal(s.medianKickBassOffsetBeats,0.25);
  assert.equal(s.medianKickBassOffsetMs,125);
  assert.equal(s.kicksWithBassSupport,1);
  assert.ok(s.longestRestBeats>=5);
});
test("No bass, no kicks, bad tolerance and empty song are explicitly handled",()=>{
  const none=inspectBassHeadGroove({meta:{beatsPerBar:4},tracks:[],structure:[]});
  assert.equal(none.sourceBassNotes,0);
  assert.equal(none.overall.measuredSections,0);
  const x=fixture();x.tracks[0].notes=[];
  assert.equal(inspectBassHeadGroove(x).sections[0].status,"no-kick-reference");
  assert.throws(()=>inspectBassHeadGroove(x,{lockToleranceBeats:0.3}),/lockToleranceBeats/);
  const y=fixture();y.tracks[1].notes=[];
  assert.equal(inspectBassHeadGroove(y).sections[0].lockRatio,null);
});
