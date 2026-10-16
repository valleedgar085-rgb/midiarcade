/**
 * Developer-only, fixed-seed observation of how guarded bass shifts relate to
 * REAL kick hits. Does not generate different music, modify audio, or select
 * a production candidate. Usage:
 * node scripts/audit-bass-head-kick-context.mjs --indices 4,7,8 --json /tmp/bass-context.json
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
 generateNew,evaluateSongCandidate,evaluateSongReleaseGate,encodeMidiVerified,
} from "../src/music-engine.js";
import { createBassHeadBounceCandidates } from "../src/core/groove-pocket-refinement.js";
import { inspectBassHeadTimingChanges } from "./lib/bass-head-timing-context.mjs";

function flag(name,fallback){
 const at=process.argv.indexOf(name);
 return at<0?fallback:process.argv[at+1];
}
const indices=flag("--indices","4,7,8").split(",").map(x=>Number(x.trim()));
if(!indices.length||indices.some(x=>!Number.isSafeInteger(x)||x<4||x>40)
 ||new Set(indices).size!==indices.length)
 throw new Error("Use unique holdout seed indices 4..40");
const output=path.resolve(flag("--json","tmp/bass-head-kick-context.json"));
const rows=[];
for(const i of indices){
 const genre="neoSoul",seed="bass-head-census-"+genre+"-"+String(i).padStart(2,"0");
 const original=generateNew({genre,seed,bars:32,key:"E",scale:"minor",
   energy:.68,complexity:.62,variation:.62,evolution:.68,
   swing:.14,humanize:.12});
 const frozen=JSON.stringify(original.tracks);
 const proposals=createBassHeadBounceCandidates(original,{bassHeadBounceV1:true});
 const candidate=proposals.find(x=>x.id==="bass-head-answer-quarter");
 if(frozen!==JSON.stringify(original.tracks))throw new Error("Generator baseline was modified: "+seed);
 if(!candidate){
   rows.push({genre,seed,status:"no-safe-answer-proposal",changedNotes:0,notes:[]});
   console.log("BASS_CONTEXT_CASE",JSON.stringify(rows.at(-1)));
   continue;
 }
 const before=evaluateSongCandidate(original),after=evaluateSongCandidate(candidate.song);
 const baselineGate=evaluateSongReleaseGate(original,before);
 const proposedGate=evaluateSongReleaseGate(candidate.song,after);
 const audit=inspectBassHeadTimingChanges(original,candidate.song);
 if(frozen!==JSON.stringify(original.tracks))throw Error("Context inspection mutated seed "+seed);
 const approved=baselineGate.passed&&proposedGate.passed&&after.score>=before.score-.01;
 const exportReport=approved?encodeMidiVerified(candidate.song):null;
 const row={genre,seed,status:audit.status,changedNotes:audit.changedNotes,
   matched:audit.measuredNotes,towardNextKick:audit.shiftsTowardUpcomingKick,
   movedIntoResponse:audit.shiftedIntoResponse,baselineScore:before.score,
   candidateScore:after.score,releasePassed:proposedGate.passed,
   exportParityVerified:exportReport?.audit?.passed??false,
   notes:audit.notes};
 rows.push(row);
 console.log("BASS_CONTEXT_CASE",JSON.stringify({
   seed,status:row.status,changedNotes:row.changedNotes,
   towardNextKick:row.towardNextKick,movedIntoResponse:row.movedIntoResponse,
   releasePassed:row.releasePassed}));
}
const summary={
 songs:rows.length,withCandidate:rows.filter(x=>x.changedNotes>0).length,
 changedAttacks:rows.reduce((n,x)=>n+x.changedNotes,0),
 matchedAttacks:rows.reduce((n,x)=>n+(x.matched??0),0),
 newAnticipations:rows.reduce((n,x)=>n+(x.towardNextKick??0),0),
 newResponses:rows.reduce((n,x)=>n+(x.movedIntoResponse??0),0),
 unmeasuredAttacks:rows.reduce((n,x)=>n+((x.changedNotes??0)-(x.matched??0)),0),
};
const report={version:1,baseline:"original seeded generator unchanged",
  scope:"read-only timing-relative observation; no rhythm editor or release selector",
  sourceCommit:"a400adfc8111315be219445a3d90b5573078a050",
  summary,rows,caveats:[
    "An after-grid shift may anticipate the following kick; neither genre nor preset name establishes the relationship.",
    "Nearest kick measurements describe rhythmic proximity, not listener-rated groove or phase cancellation.",
    "The original song remains the default. No notes, presets, or audio engine were modified.",
    "Nonmatching note identities are explicitly reported, never inferred."
  ]};
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2)+"\n");
console.log("BASS_CONTEXT_SUMMARY",JSON.stringify(summary));
