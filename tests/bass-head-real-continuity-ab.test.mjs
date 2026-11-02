import assert from "node:assert/strict";
import test from "node:test";
import { generateNew } from "../src/music-engine.js";
import { createBassContinuityCandidates,analyzeBassContinuity } from "../src/core/bass-continuity-refinement.js";

const fixed = {genre:"funk",seed:"bass-head-census-funk-01",bars:32,key:"E",scale:"minor",
 energy:0.68,complexity:0.62,variation:0.62,evolution:0.68,swing:0.14,humanize:0.12};
test("real Funk census reproduces missed body bass continuity and offers existing repair",()=>{
 const baseline=generateNew(fixed);
 const frozen=structuredClone(baseline);
 const before=analyzeBassContinuity(baseline);
 assert.ok(before.deficit>0,"baseline has an independently observed continuity deficit");
 const candidates=createBassContinuityCandidates(baseline);
 assert.ok(candidates.length>0 && candidates.length<=2);
 for(const candidate of candidates){
   assert.ok(candidate.changedNotes>=1&&candidate.changedNotes<=3);
   const after=analyzeBassContinuity(candidate.song);
   assert.ok(after.deficit<before.deficit);
   const originalBass=baseline.tracks.find(t=>t.id==="bass").notes;
   const revisedBass=candidate.song.tracks.find(t=>t.id==="bass").notes;
   assert.equal(revisedBass.length,originalBass.length+candidate.changedNotes);
   for(const original of originalBass)
     assert.ok(revisedBass.some(note=>JSON.stringify(note)===JSON.stringify(original)),
       "original authored bass event must remain unchanged");
   for(const original of baseline.tracks.filter(t=>t.id!=="bass"))
     assert.deepEqual(candidate.song.tracks.find(t=>t.id===original.id),original,
       "other tracks must remain untouched");
 }
 assert.deepEqual(baseline,frozen);
});
