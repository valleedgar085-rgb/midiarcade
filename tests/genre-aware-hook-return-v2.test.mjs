import assert from "node:assert/strict";
import test from "node:test";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import {
  GENRE_HOOK_RETURN_V2,
  createGenreAwareHookReturnCandidates,
} from "../src/core/genre-aware-hook-return-v2.js";

const sourcePitches = [64, 67, 69, 71, 72, 74, 76, 74];
const shifted = [76, 74, 72, 71, 69, 67, 64, 67];
const phrase = (start, notes = sourcePitches, protect = false) =>
  notes.map((pitch, i) => ({
    start: start + i + 0.5, pitch, duration: 0.35, velocity: 84,
    ...(protect ? { motifMemoryCore: true } : {}),
  }));

function song(genre = "neoSoul", options = {}) {
  return {
    genre, meta: { genre, beatsPerBar: 4, keyPc: 4, scaleIntervals: [0, 2, 3, 5, 7, 8, 10] },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 8 },
      { id: "verse-1", name: "verse", startBeat: 8, endBeat: 16 },
      { id: "chorus-2", name: "chorus", startBeat: 16, endBeat: 24 },
    ],
    tracks: [
      { id: "drums", notes: [{ start: 0, duration: 0.25, pitch: 36, velocity: 85 }] },
      { id: "bass", notes: [{ start: 0, duration: 0.5, pitch: 40, velocity: 80 }] },
      { id: "chords", notes: [{ start: 0, duration: 1, pitch: 60, velocity: 72 }] },
      { id: "melody", notes: [
        ...phrase(0,sourcePitches), { start: 9, pitch: 64, duration: 0.5, velocity: 73 },
        { start: 13, pitch: 67, duration: 0.5, velocity: 73 },
        ...phrase(16,options.returning ?? shifted, options.protected ?? false),
      ] },
    ],
  };
}
const edits = (before,after) => before.tracks.find(t=>t.id==="melody").notes.flatMap((note,i)=>{
 const next=after.tracks.find(t=>t.id==="melody").notes[i];
 return note.pitch!==next.pitch?[{before:note,after:next,index:i}]:[];
});

test("V2 safely proposes an opt-in recognizable chorus contour for neo-soul and pop radio",()=>{
  for (const genre of ["neoSoul","popRadio"]) {
    const original=song(genre);
    const frozen=structuredClone(original);
    const before=evaluateChorusHookRecurrence(original);
    assert.equal(before.status,"evaluated");
    assert.ok(before.score<66,"test requires weak chorus return");
    const candidates=createGenreAwareHookReturnCandidates(original);
    assert.ok(candidates.length>=1,genre+" should have a bounded proposal");
    assert.ok(candidates.length<=3);
    const proposal=candidates[0];
    const changed=edits(original,proposal.song);
    assert.equal(changed.length,1);
    assert.ok(proposal.afterScore>before.score);
    assert.equal(proposal.targetSectionId,"chorus-2");
    assert.ok(changed[0].after.pitch>=57 && changed[0].after.pitch<=79);
    assert.ok(Math.abs(changed[0].after.pitch-changed[0].before.pitch)<=6);
    assert.deepEqual(proposal.song.tracks.slice(0,3),original.tracks.slice(0,3));
    for(const pair of changed){
      assert.equal(pair.before.start,pair.after.start);
      assert.equal(pair.before.duration,pair.after.duration);
      assert.equal(pair.before.velocity,pair.after.velocity);
      assert.equal(pair.after.hookReturnV2Role,"contour-recall");
    }
    assert.deepEqual(original,frozen);
    assert.deepEqual(candidates.map(c=>[c.id,c.afterScore]),createGenreAwareHookReturnCandidates(original).map(c=>[c.id,c.afterScore]));
  }
});

test("V2 preserves protected anchors, sparse phrases, unverified pitch authority and strong motifs",()=>{
  assert.deepEqual(createGenreAwareHookReturnCandidates(song("neoSoul",{protected:true})),[]);
  assert.deepEqual(createGenreAwareHookReturnCandidates(song("neoSoul",{returning:[64,67]})),[]);
  assert.deepEqual(createGenreAwareHookReturnCandidates(song("neoSoul",{returning:sourcePitches})),[]);
  assert.deepEqual(createGenreAwareHookReturnCandidates(song("neoSoul"),{maxCandidates:0}),[]);
  const withoutScale=song("neoSoul");
  delete withoutScale.meta.scaleIntervals;
  assert.deepEqual(createGenreAwareHookReturnCandidates(withoutScale),[]);
  assert.deepEqual(createGenreAwareHookReturnCandidates(song("jazz")),[]);
});

test("genre-aware V2 is intentionally limited, deterministic, and does not add notes or edit verses",()=>{
  for(const genre of ["neoSoul","rnbSoul","popRadio","afrobeats","funk","synthwave","synthPopRadio","loFiHipHop","hipHop","rap","pop","drill"]){
    assert.ok(GENRE_HOOK_RETURN_V2.includes(genre),genre);
    const original=song(genre);
    const candidates=createGenreAwareHookReturnCandidates(original);
    assert.ok(candidates.length<=3);
    for(const candidate of candidates){
      const a=original.tracks.find(t=>t.id==="melody").notes;
      const b=candidate.song.tracks.find(t=>t.id==="melody").notes;
      assert.equal(a.length,b.length);
      assert.deepEqual(a.slice(0,10),b.slice(0,10),"first hook and verse remain authoritative");
      assert.equal(edits(original,candidate.song).length,1);
    }
  }
});
