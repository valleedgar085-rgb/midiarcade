import assert from "node:assert/strict";
import test from "node:test";
import { createBassEnsembleCohesionCandidates } from "../src/core/bass-ensemble-cohesion-shadow.js";

const fixture = () => ({
  meta: { beatsPerBar: 4, bars: 8, genre: "hipHop" },
  structure: [{id:"v1",name:"verse",startBeat:0,endBeat:32}],
  harmony: [{start:0,duration:32,rootPc:4,pitchClasses:[4,7,11]}],
  tracks: [
    {id:"drums",notes:[{start:0,pitch:36},{start:4,pitch:36}]},
    {id:"bass",notes:[
      {id:"a",start:0,pitch:43,duration:.4,velocity:90},
      {id:"b",start:4,pitch:43,duration:.4,velocity:90},
      {id:"c",start:8,pitch:40,duration:.4,velocity:90,phraseAnchor:true},
    ]},
    {id:"chords",notes:[{start:0,pitch:64,duration:2}]},
  ],
});
test("opt-in only, deterministic, at most three candidates, source unmodified", () => {
  const song=fixture(), snapshot=structuredClone(song);
  assert.deepEqual(createBassEnsembleCohesionCandidates(song), []);
  const a=createBassEnsembleCohesionCandidates(song,{bassEnsembleCohesionShadow:true});
  const b=createBassEnsembleCohesionCandidates(song,{bassEnsembleCohesionShadow:true});
  assert.ok(a.length>=1&&a.length<=3);
  assert.deepEqual(a,b);
  assert.deepEqual(song,snapshot);
  for(const variant of a) {
    assert.equal(variant.gate,"shadow-only");
    assert.deepEqual(variant.song.tracks[0],song.tracks[0]);
    assert.deepEqual(variant.song.tracks[2],song.tracks[2]);
    assert.equal(variant.song.tracks[1].notes.length,3);
    assert.deepEqual(variant.song.tracks[1].notes.map(n=>[n.id,n.start,n.duration,n.velocity]),
      song.tracks[1].notes.map(n=>[n.id,n.start,n.duration,n.velocity]));
    assert.deepEqual(variant.song.tracks[1].notes[2],song.tracks[1].notes[2]);
  }
});
test("explicit bass rest and unavailable harmony never trigger edits",()=>{
 const song=fixture();
 song.producerIntent={scenes:[{sectionId:"v1",roles:{bass:"rest"}}]};
 assert.deepEqual(createBassEnsembleCohesionCandidates(song,{bassEnsembleCohesionShadow:true}),[]);
 delete song.producerIntent;
 song.harmony=[];
 assert.deepEqual(createBassEnsembleCohesionCandidates(song,{bassEnsembleCohesionShadow:true}),[]);
});
