import assert from "node:assert/strict";
import test from "node:test";
import { createBassHeadBounceCandidates } from "../src/core/groove-pocket-refinement.js";
import { inspectBassHeadGroove } from "../scripts/lib/bass-head-groove-census.mjs";

function song(genre="funk",protectedAnswer=false) {
  const bass=[];
  for(const bar of [0,4,8,12]){
    bass.push({id:"b-"+bar+"-0",start:bar,pitch:40,duration:.35,velocity:88,phraseAnchor:true});
    bass.push({id:"b-"+bar+"-1",start:bar+1,pitch:40,duration:.30,velocity:84,
      ...(protectedAnswer?{phraseAnchor:true}:{})});
    bass.push({id:"b-"+bar+"-1.5",start:bar+1.5,pitch:43,duration:.24,velocity:81});
    bass.push({id:"b-"+bar+"-2",start:bar+2,pitch:40,duration:.42,velocity:90});
  }
  return {
    id:"bass-head-fixture",genre,bars:4,
    meta:{genre,bars:4,beatsPerBar:4,tempo:110,totalBeats:16},
    structure:[{id:"verse-1",name:"verse",startBeat:0,endBeat:8},
      {id:"chorus-1",name:"chorus",startBeat:8,endBeat:16}],
    harmony:[{start:0,duration:8,degree:0},{start:8,duration:8,degree:0}],
    tracks:[
      {id:"drums",notes:Array.from({length:8},(_,i)=>({id:"k"+i,start:i*2,pitch:36,duration:.1,velocity:104}))},
      {id:"bass",notes:bass},
      {id:"chords",notes:[{start:0,pitch:64,duration:8,velocity:73}]},
      {id:"melody",notes:[{start:2,pitch:72,duration:.5,velocity:80}]},
    ],
  };
}
const byId=(song,id)=>song.tracks.find(t=>t.id===id)?.notes??[];

test("Bass Head bounce is strictly opt-in and genre-limited",()=>{
  assert.deepEqual(createBassHeadBounceCandidates(song("funk")),[]);
  assert.deepEqual(createBassHeadBounceCandidates(song("funk"),{bassHeadBounceV1:false}),[]);
  assert.deepEqual(createBassHeadBounceCandidates(song("house"),{bassHeadBounceV1:true}),[]);
  assert.deepEqual(createBassHeadBounceCandidates(song("trap"),{bassHeadBounceV1:true}),[]);
  const fused=song("funk");fused.meta.secondaryGenre="pop";
  assert.deepEqual(createBassHeadBounceCandidates(fused,{bassHeadBounceV1:true}),[]);
});

test("two deterministic bounce alternatives preserve the original song, kick, register, note count and dynamics",()=>{
  for(const genre of ["funk","neoSoul"]){
    const source=song(genre);
    const snapshot=structuredClone(source);
    const first=createBassHeadBounceCandidates(source,{bassHeadBounceV1:true});
    const again=createBassHeadBounceCandidates(source,{bassHeadBounceV1:true});
    assert.ok(first.length>=1&&first.length<=2);
    assert.deepEqual(first.map(c=>[c.id,c.changedNotes,c.offbeatDelta]),
      again.map(c=>[c.id,c.changedNotes,c.offbeatDelta]));
    assert.deepEqual(source,snapshot);
    const originalBass=new Map(byId(source,"bass").map(n=>[n.id,n]));
    const originalGroove=inspectBassHeadGroove(source);
    for(const candidate of first){
      const next=candidate.song;
      assert.deepEqual(byId(next,"drums"),byId(source,"drums"));
      assert.deepEqual(byId(next,"chords"),byId(source,"chords"));
      assert.deepEqual(byId(next,"melody"),byId(source,"melody"));
      assert.equal(byId(next,"bass").length,byId(source,"bass").length);
      assert.ok(candidate.changedNotes>=1&&candidate.changedNotes<=4);
      assert.ok(candidate.offbeatDelta>0);
      const compare=inspectBassHeadGroove(next);
      assert.equal(compare.overall.lockedAttacks,originalGroove.overall.lockedAttacks);
      assert.ok(compare.overall.offbeatAttacks>originalGroove.overall.offbeatAttacks);
      const touched=byId(next,"bass").filter(n=>n.bassHeadBounceRole);
      assert.equal(touched.length,candidate.changedNotes);
      for(const updated of byId(next,"bass")){
        const previous=originalBass.get(updated.id);
        assert.ok(previous);
        assert.equal(updated.pitch,previous.pitch);
        assert.equal(updated.duration,previous.duration);
        assert.equal(updated.velocity,previous.velocity);
        assert.ok(Math.abs(updated.start-previous.start)<=.25+1e-8);
        if(previous.phraseAnchor)assert.equal(updated.start,previous.start);
      }
      assert.ok(compare.overall.adjacentBassOverlaps<=originalGroove.overall.adjacentBassOverlaps);
    }
  }
});

test("preserves protected notes and returns no candidate when every eligible answer is protected",()=>{
 const original=song("neoSoul",true);
 assert.deepEqual(createBassHeadBounceCandidates(original,{bassHeadBounceV1:true}),[]);
});

test("refuses a bounce move that collides with another bass note or crosses a chord change",()=>{
 const collision=song();
 for(const note of byId(collision,"bass")){
   if(note.id.endsWith("-1.5"))note.start=Math.floor(note.start)+1.25;
 }
 const options=createBassHeadBounceCandidates(collision,{bassHeadBounceV1:true});
 assert.ok(options.every(c=>c.changedNotes<=4));
 const harmonic=song();
 harmonic.harmony=[
   {start:0,duration:1.125,degree:0},{start:1.125,duration:14.875,degree:4},
 ];
 const altered=createBassHeadBounceCandidates(harmonic,{bassHeadBounceV1:true});
 assert.ok(altered.every(c=>byId(c.song,"bass")
   .filter(n=>n.bassHeadBounceRole)
   .every(n=>n.id!=="b-0-1")));
});
