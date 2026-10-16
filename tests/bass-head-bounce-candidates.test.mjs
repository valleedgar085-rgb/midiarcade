import assert from "node:assert/strict";
import test from "node:test";
import { createBassHeadBounceCandidates } from "../src/core/bass-head-bounce-candidates.js";

function fixture(genre="funk"){
  return {
    genre,meta:{genre,bars:8,beatsPerBar:4,totalBeats:32,tempo:112},
    structure:[
      {id:"verse",name:"verse",startBeat:0,endBeat:16},
      {id:"chorus",name:"chorus",startBeat:16,endBeat:32},
    ],
    harmony:Array.from({length:8},(_,i)=>({start:i*4,duration:4,rootPc:4})),
    grooveConductor:{
      bars:Array.from({length:8},(_,i)=>({bar:i,sectionId:i<4?"verse":"chorus",
        bassPulses:[0,1.25,2.5,3.25],
      })),
    },
    tracks:[
      {id:"drums",notes:Array.from({length:8},(_,i)=>[
        {start:i*4,pitch:36,duration:0.1},
        {start:i*4+2,pitch:36,duration:0.1},
      ]).flat()},
      {id:"bass",notes:Array.from({length:8},(_,i)=>[
        {start:i*4,pitch:40,duration:0.5,velocity:90,phraseAnchor:true},
        {start:i*4+1,pitch:40,duration:0.2,velocity:78},
        {start:i*4+2.5,pitch:47,duration:0.2,velocity:76},
      ]).flat()},
      ...["chords","melody","counterpoint","pad"].map(id=>({id,notes:[]})),
    ],
  };
}
test("Funk candidate creates bouncy offbeat attack without adding notes or touching anchors",()=>{
  const song=fixture();const before=structuredClone(song);
  const candidates=createBassHeadBounceCandidates(song);
  assert.ok(candidates.length>=1&&candidates.length<=2);
  const bass=song.tracks[1].notes,alternative=candidates[0].song.tracks[1].notes;
  assert.equal(bass.length,alternative.length);
  assert.deepEqual(song,before);
  assert.deepEqual(song.tracks[0],candidates[0].song.tracks[0]);
  assert.deepEqual(song.tracks.slice(2),candidates[0].song.tracks.slice(2));
  const changes=alternative.filter((n,i)=>n.start!==bass[i].start);
  assert.ok(changes.length>=1&&changes.length<=2);
  for(const n of changes)assert.ok([0.25,0.75].includes(((n.start%1)+1)%1));
  for(let i=0;i<alternative.length;i++){
    assert.equal(alternative[i].pitch,bass[i].pitch);
    assert.equal(alternative[i].duration,bass[i].duration);
    assert.equal(alternative[i].velocity,bass[i].velocity);
    if(bass[i].phraseAnchor)assert.equal(alternative[i].start,bass[i].start);
  }
  assert.deepEqual(candidates.map(c=>[c.id,c.changedNotes]),createBassHeadBounceCandidates(song).map(c=>[c.id,c.changedNotes]));
});
test("Neo-Soul can audition; non bass-focused genres, missing groove contracts, and muted bass fail closed",()=>{
  assert.ok(createBassHeadBounceCandidates(fixture("neoSoul")).length>0);
  assert.deepEqual(createBassHeadBounceCandidates(fixture("house")),[]);
  const without=fixture();delete without.grooveConductor;assert.deepEqual(createBassHeadBounceCandidates(without),[]);
  const muted=fixture();muted.tracks[1].notes=[];assert.deepEqual(createBassHeadBounceCandidates(muted),[]);
});
test("Locked note, kick attack, chord boundary, and overlapping bass voice cannot be moved",()=>{
  const song=fixture();
  const notes=song.tracks[1].notes;
  for(const n of notes.filter(n=>n.start%4===1))n.locked=true;
  assert.deepEqual(createBassHeadBounceCandidates(song),[]);
  const other=fixture();
  for(const n of other.tracks[1].notes.filter(n=>n.start%4===1))n.duration=3.75;
  assert.deepEqual(createBassHeadBounceCandidates(other),[]);
});
