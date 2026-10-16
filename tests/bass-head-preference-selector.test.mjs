import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  summarizeBassHeadPreferences,
  planBassHeadAuditions,
  assessBassHeadCandidateSafety,
} from "../scripts/lib/bass-head-preference-selector.mjs";

const feedback=JSON.parse(fs.readFileSync(
  fileURLToPath(new URL("../scripts/fixtures/bass-head-listening-round-1.json",import.meta.url)),"utf8"));
const summary=()=>summarizeBassHeadPreferences(feedback);
const item=(report,genre,proposal)=>report.groups.find(x=>x.genre===genre&&x.proposal===proposal);
const answer="bass-head-answer-quarter";
const pickup="bass-head-pickup-quarter";

test("decodes five B selections against verified answer key rather than assuming B always means new",()=>{
  const s=summary();
  assert.equal(s.responses,5);
  assert.equal(s.experimentalWins,3);
  assert.equal(s.originalWins,2);
  assert.equal(s.uniqueSongCount,3);
  assert.equal(item(s,"neoSoul",answer).experimentalWins,2);
  assert.equal(item(s,"neoSoul",answer).independentWinningSongs,2);
  assert.equal(item(s,"neoSoul",answer).tier,"priority-review");
  assert.equal(item(s,"neoSoul",pickup).originalWins,2);
  assert.equal(item(s,"neoSoul",pickup).tier,"prefer-baseline");
  assert.equal(item(s,"funk",pickup).experimentalWins,1);
  assert.equal(item(s,"funk",pickup).tier,"collect-more");
  assert.equal(summary().defaultActivationAllowed,false);
});

test("preferences are deterministic regardless of answer-key row order",()=>{
  const shuffled={...feedback,choices:feedback.choices.slice().reverse()};
  assert.deepEqual(summarizeBassHeadPreferences(shuffled),summary());
});

test("rejects duplicate blind IDs and malformed preference records rather than silently averaging",()=>{
  const duplicated={...feedback,choices:[...feedback.choices,feedback.choices[0]]};
  assert.throws(()=>summarizeBassHeadPreferences(duplicated),/duplicate/i);
  assert.throws(()=>summarizeBassHeadPreferences({...feedback,choices:[{...feedback.choices[0],preferredVersion:"C"}]}),/A or B/i);
  assert.throws(()=>summarizeBassHeadPreferences({...feedback,choices:[{...feedback.choices[0],experimentalVersion:"C"}]}),/A or B/i);
});

test("two repeats of one seed do not qualify as independent listening confirmation",()=>{
  const extra=structuredClone(feedback);
  extra.choices=extra.choices.filter(x=>x.genre==="neoSoul"&&x.proposal===answer);
  extra.choices[1].seed=extra.choices[0].seed;
  const s=summarizeBassHeadPreferences(extra);
  assert.equal(item(s,"neoSoul",answer).experimentalWins,2);
  assert.equal(item(s,"neoSoul",answer).independentWinningSongs,1);
  assert.equal(item(s,"neoSoul",answer).tier,"collect-more");
});

test("audition planning keeps the original as the authority and avoids repeating rejected pickup styles",()=>{
  const s=summary();
  const options=[{id:pickup},{id:answer},{id:"other-unknown"}];
  const neo=planBassHeadAuditions(s,"neoSoul",options);
  assert.equal(neo.defaultActivationAllowed,false);
  assert.equal(neo.baseline,"original");
  assert.deepEqual(neo.auditions.map(x=>x.id),[answer,"other-unknown"]);
  assert.equal(neo.auditions[0].tier,"priority-review");
  assert.deepEqual(neo.skipped.map(x=>x.id),[pickup]);
  const funk=planBassHeadAuditions(s,"funk",[{id:pickup},{id:answer}]);
  assert.equal(funk.auditions.find(x=>x.id===pickup).tier,"collect-more");
  assert.equal(planBassHeadAuditions(s,"house",[{id:pickup}]).auditions.length,0);
});

function sample(){
  return {meta:{tempo:110},tracks:[
    {id:"drums",notes:[{pitch:36,start:0,duration:.1}]},
    {id:"bass",notes:[{id:"b1",start:1,pitch:40,duration:.25,velocity:89},
      {id:"b2",start:2,pitch:43,duration:.5,velocity:90}]},
    {id:"chords",notes:[{pitch:64,start:0,duration:3}]},
  ]};
}
function verdict(baseline,candidate,options={}){
  return assessBassHeadCandidateSafety({
    baseline,candidate,
    beforeCritic:{score:90},afterCritic:{score:90},
    beforeRelease:{passed:true},afterRelease:{passed:true},
    beforeGroove:{overall:{lockedAttacks:1,adjacentBassOverlaps:0,offbeatAttacks:0}},
    afterGroove:{overall:{lockedAttacks:1,adjacentBassOverlaps:0,offbeatAttacks:1}},
    ...options,
  });
}
test("safe shadow assessment rejects drum changes, critic regression, lost locks and added overlap",()=>{
  const baseline=sample(),proposal=structuredClone(baseline);
  proposal.tracks[1].notes[0].start=1.25;
  proposal.tracks[1].notes[0].bassHeadBounceRole="kick-answer";
  proposal.tracks[1].notes[0].bassHeadBounceSectionId="verse";
  const before=structuredClone(baseline);
  const good=verdict(baseline,proposal);
  assert.equal(good.eligible,true);
  assert.deepEqual(baseline,before);
  assert.equal(verdict(baseline,proposal,{afterCritic:{score:89}}).eligible,false);
  assert.equal(verdict(baseline,proposal,{afterRelease:{passed:false}}).eligible,false);
  assert.equal(verdict(baseline,proposal,{afterGroove:{overall:{lockedAttacks:0,adjacentBassOverlaps:0,offbeatAttacks:1}}}).eligible,false);
  assert.equal(verdict(baseline,proposal,{afterGroove:{overall:{lockedAttacks:1,adjacentBassOverlaps:1,offbeatAttacks:1}}}).eligible,false);
  const drumModified=structuredClone(proposal);drumModified.tracks[0].notes[0].start=.1;
  assert.equal(verdict(baseline,drumModified).eligible,false);
  const newPitch=structuredClone(proposal);newPitch.tracks[1].notes[0].pitch=41;
  assert.equal(verdict(baseline,newPitch).eligible,false);
  const newLength=structuredClone(proposal);newLength.tracks[1].notes[0].duration=.5;
  assert.equal(verdict(baseline,newLength).eligible,false);
});
