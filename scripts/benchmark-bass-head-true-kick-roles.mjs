/**
 * Shadow-only blind comparison of REAL kick-relative bass responses and
 * anticipations against original unchanged MIDI Arcade songs.
 *
 * No default app feature or release gate is installed by this script.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
 generateNew,evaluateSongCandidate,evaluateSongReleaseGate,encodeMidiVerified,
} from "../src/music-engine.js";
import { createKickRelativeBassShadowCandidates } from "./lib/bass-head-true-kick-candidates.mjs";
import { inspectBassHeadTimingChanges } from "./lib/bass-head-timing-context.mjs";
import { inspectBassHeadGroove } from "./lib/bass-head-groove-census.mjs";

function arg(name,defaultValue){
 const i=process.argv.indexOf(name);
 return i<0?defaultValue:process.argv[i+1];
}
function positiveInt(name,fallback,max){
 const v=Number(arg(name,fallback));
 if(!Number.isSafeInteger(v)||v<1||v>max)throw Error(name+" must be 1.."+max);
 return v;
}
const start=positiveInt("--start",10,90);
if(start<10)throw Error("Phase 5 must use unseen seed indices >=10");
const seeds=positiveInt("--seeds",8,15);
const bars=positiveInt("--bars",32,64);
const reportPath=path.resolve(arg("--out","tmp/bass-head-true-kick-report.json"));
const midiFolder=path.resolve(arg("--pack","tmp/bass-head-kick-role-blind"));
const answerKeyPath=path.resolve(arg("--key","tmp/bass-head-kick-role-answer-key.json"));
if(new Set([reportPath,midiFolder,answerKeyPath]).size!==3||
 answerKeyPath.startsWith(midiFolder+path.sep)||reportPath.startsWith(midiFolder+path.sep))
 throw Error("Report, MIDI pack and answer key must be stored separately");

const genres=["funk","neoSoul"],rows=[],pairs=[],answerKey=[];
const maxPacks=12;
function normalizeNotesWithoutOnsets(notes){
 return notes.map(note=>{
  const c={...note};
  for(const key of ["start","bassHeadBounceRole","bassHeadBounceSectionId"])delete c[key];
  return JSON.stringify(Object.entries(c).sort((a,b)=>a[0].localeCompare(b[0])));
 }).sort();
}
function structuralSafety(original,proposed){
 if(original.tracks.length!==proposed.tracks.length)return false;
 for(let i=0;i<original.tracks.length;i++){
  const a=original.tracks[i],b=proposed.tracks[i];
  if(a.id!==b?.id)return false;
  if(a.id!=="bass"&&JSON.stringify(a)!==JSON.stringify(b))return false;
  if(a.id==="bass"){
   if(JSON.stringify(normalizeNotesWithoutOnsets(a.notes))!==
     JSON.stringify(normalizeNotesWithoutOnsets(b.notes)))return false;
   if(JSON.stringify({...a,notes:null})!==JSON.stringify({...b,notes:null}))return false;
  }
 }
 return true;
}

for(const genre of genres)for(let i=start;i<start+seeds;i++){
 const seed="bass-head-census-"+genre+"-"+String(i).padStart(2,"0");
 const original=generateNew({genre,seed,bars,key:"E",scale:"minor",
   energy:.68,complexity:.62,variation:.62,evolution:.68,swing:.14,humanize:.12});
 const frozen=JSON.stringify(original);
 const originalQuality=evaluateSongCandidate(original);
 const originalRelease=evaluateSongReleaseGate(original,originalQuality);
 const originalGroove=inspectBassHeadGroove(original);
 const candidates=createKickRelativeBassShadowCandidates(original,{kickRelativeShadow:true});
 const row={genre,seed,sourceBassNotes:originalGroove.sourceBassNotes,
   candidateCount:candidates.length,attempts:[],baselinePassed:originalRelease.passed};
 const qualified=[];
 for(const candidate of candidates){
  const proposedQuality=evaluateSongCandidate(candidate.song);
  const proposedRelease=evaluateSongReleaseGate(candidate.song,proposedQuality);
  const proposedGroove=inspectBassHeadGroove(candidate.song);
  const context=inspectBassHeadTimingChanges(original,candidate.song);
  const topology=structuralSafety(original,candidate.song);
  const locked=proposedGroove.overall.lockedAttacks===originalGroove.overall.lockedAttacks;
  const overlap=proposedGroove.overall.adjacentBassOverlaps<=originalGroove.overall.adjacentBassOverlaps;
  const actualRole=context.status==="measured"&&context.measuredNotes===candidate.changedNotes
   &&context.notes.every(n=>n.proposedKick.role===candidate.movement);
  const criticDelta=Number((proposedQuality.score-originalQuality.score).toFixed(3));
  const eligible=topology&&locked&&overlap&&actualRole
   &&originalRelease.passed&&proposedRelease.passed&&criticDelta>=-.01;
  const attempt={id:candidate.id,movement:candidate.movement,
    changedNotes:candidate.changedNotes,context,topology,
    locked,overlap,actualRole,criticDelta,releasePassed:proposedRelease.passed,
    releaseFailures:proposedRelease.failures,eligible,exportVerified:false};
  if(eligible){
   const check=encodeMidiVerified(candidate.song);
   if(!check.audit.passed)throw Error("Failed real MIDI export parity: "+seed+"/"+candidate.id);
   attempt.exportVerified=true;
   qualified.push({candidate,bytes:check.bytes});
  }
  row.attempts.push(attempt);
 }
 if(frozen!==JSON.stringify(original))throw Error("Shadow changed original source: "+seed);
 // Matched baseline comparison: one unchanged song with one or BOTH role
 // variants. Rotate concealed positions deterministically to prevent all
 // accepted changes from always occupying the same A/B slot.
 if(qualified.length>0&&pairs.length<maxPacks){
  const count=pairs.length+1,blindId="bass-kick-"+String(count).padStart(2,"0");
  const unchanged=encodeMidiVerified(original);
  if(!unchanged.audit.passed)throw Error("Original MIDI parity failed: "+seed);
  const choices=[{label:"original",bytes:unchanged.bytes},...qualified.map(x=>({
   label:x.candidate.id,bytes:x.bytes
  }))];
  const rotation=(count-1)%choices.length;
  const rotated=choices.slice(rotation).concat(choices.slice(0,rotation));
  const labels=["A","B","C"];
  await fs.mkdir(midiFolder,{recursive:true});
  for(let c=0;c<rotated.length;c++)
   await fs.writeFile(path.join(midiFolder,blindId+"-"+labels[c]+".mid"),rotated[c].bytes);
  // Store mapping exclusively outside the public blind MIDI artifact.
  answerKey.push({blindId,genre,seed,mapping:Object.fromEntries(rotated.map((choice,j)=>[labels[j],choice.label]))});
  pairs.push({blindId,genre,versions:rotated.length,eligibleRoles:qualified.map(x=>x.candidate.movement)});
  row.blindId=blindId;
 }
 rows.push(row);
 console.log("BASS_KICK_ROLE_CASE",JSON.stringify({
   genre,seed,candidates:candidates.length,
   safe:qualified.map(x=>x.candidate.id),
   pack:row.blindId??null,
 }));
}
const summary={
 songs:rows.length,withSafeAlternatives:rows.filter(x=>x.attempts.some(c=>c.eligible)).length,
 safeResponse:rows.reduce((n,x)=>n+x.attempts.filter(a=>a.eligible&&a.movement==="response").length,0),
 safeAnticipation:rows.reduce((n,x)=>n+x.attempts.filter(a=>a.eligible&&a.movement==="anticipation").length,0),
 ineligible:rows.reduce((n,x)=>n+x.attempts.filter(a=>!a.eligible).length,0),
 twoRoleComparisons:pairs.filter(x=>x.versions===3).length,
 twoWayComparisons:pairs.filter(x=>x.versions===2).length,
 blindPacks:pairs.length,
};
await fs.mkdir(path.dirname(reportPath),{recursive:true});
await fs.writeFile(reportPath,JSON.stringify({
 version:1,mode:"developer-only shadow; normal song generation UNCHANGED",
 baselineCommit:"c5844d6310ab96c4d0d10dd6a916b656477cc9f0",
 holdoutIndices:{start,end:start+seeds-1},summary,rows,pairs,
 caveats:[
  "Actual-kick relative roles are not equal to measured listener preference.",
  "No generated song is replaced; all proposals require explicit approval.",
  "Existing music critic and MIDI export parity are necessary but insufficient for improvement.",
  "Blind labels rotate across choices; open the separate answer key only after listening.",
  "No app audio, synth, or gain modification was made."
 ]},null,2)+"\n");
await fs.mkdir(path.dirname(answerKeyPath),{recursive:true});
await fs.writeFile(answerKeyPath,JSON.stringify({version:1,answerKey},null,2)+"\n");
await fs.mkdir(midiFolder,{recursive:true});
await fs.writeFile(path.join(midiFolder,"README.txt"),
 "Bass Head true kick-role blind comparisons.\n"+
 "Each numbered case compares the SAME song, with unchanged original plus up to TWO safe alternatives.\n"+
 "For cases with A/B/C, choose your favorite of A B or C; others use A/B.\n"+
 "In FL Studio use identical instruments, effects, soundfont/patch and matched playback level.\n"+
 "Listen to bass+drums first, then full arrangement. Do not open the separate answer key first.\n"+
 "These are MIDI files only: they have no synth or audio embedded.\n");
console.log("BASS_KICK_ROLE_SUMMARY",JSON.stringify(summary));
