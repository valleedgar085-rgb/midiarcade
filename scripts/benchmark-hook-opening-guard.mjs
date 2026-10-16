/**
 * Fixed-seed audition of one upstream chorus-opening performance choice.
 * This DOES NOT switch normal generation to a new engine or accept candidates.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { GENRE_PROFILES, generateNew, evaluateSongCandidate, evaluateSongReleaseGate,
  createMidiExportProjection, encodeMidiVerified } from "../src/music-engine.js";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";

const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const genres=arg("--genres","hipHop,rap,popRadio,neoSoul,rnbSoul,afrobeats,funk,synthwave,drill,pop").split(",").map(x=>x.trim());
if(genres.some(g=>!(g in GENRE_PROFILES)))throw Error("unknown genre");
const seeds=Number(arg("--seeds","2"));
if(!Number.isInteger(seeds)||seeds<1||seeds>4)throw Error("seeds must be 1–4");
const bars=Number(arg("--bars","32"));
if(!Number.isInteger(bars)||bars<24||bars>128)throw Error("bars must be 24–128");
const output=path.resolve(arg("--out","tmp/hook-opening-guard.json"));
const rows=[];
let improved=0,worsened=0,unchanged=0,releaseRegressions=0,baselineChanges=0;
function notes(song,id){return (song.tracks??[]).find(t=>t.id===id)?.notes??[];}
function trace(song,id){return notes(song,id).map(n=>[n.start,n.pitch,n.duration,n.velocity]);}
function hasChanged(left,right){return JSON.stringify(left)!==JSON.stringify(right);}
for(const genre of genres){
 for(let index=1;index<=seeds;index++){
  const seed="census-"+String(index).padStart(2,"0")+"-"+genre;
  const config={genre,seed,bars,key:"E",scale:"minor",energy:0.68,complexity:0.62,
    variation:0.62,evolution:0.68,swing:0.14,humanize:0.12,candidateCount:1};
  const before=generateNew(config);
  const control=generateNew({...config,hookReturnOpeningGuardV1:false});
  if(JSON.stringify(before.tracks)!==JSON.stringify(control.tracks)){
    baselineChanges++;throw Error("default/off diverged: "+seed);
  }
  const experiment=generateNew({...config,hookReturnOpeningGuardV1:true});
  const baselineHook=evaluateChorusHookRecurrence(before);
  const proposedHook=evaluateChorusHookRecurrence(experiment);
  const originalCritic=evaluateSongCandidate(before);
  const changedCritic=evaluateSongCandidate(experiment);
  const baselineGate=evaluateSongReleaseGate(before,originalCritic);
  const proposedGate=evaluateSongReleaseGate(experiment,changedCritic);
  const noteChanges=Object.fromEntries(["drums","bass","chords","melody","counterpoint","pad"]
    .map(id=>[id,hasChanged(trace(before,id),trace(experiment,id))]));
  const hookDelta=baselineHook.score===null||proposedHook.score===null
    ? null : proposedHook.score-baselineHook.score;
  if(hookDelta!==null){
    if(hookDelta>0)improved++;else if(hookDelta<0)worsened++;else unchanged++;
  }
  if(baselineGate.passed&&!proposedGate.passed)releaseRegressions++;
  let midiExportVerified=null;
  if(baselineGate.passed&&proposedGate.passed&&hookDelta>0){
    const base=encodeMidiVerified(before), next=encodeMidiVerified(experiment);
    midiExportVerified=base.audit?.passed&&next.audit?.passed;
    if(!midiExportVerified)throw Error("MIDI export parity failed "+seed);
    const originalProjection=createMidiExportProjection(before);
    const changedProjection=createMidiExportProjection(experiment);
    if(!originalProjection?.tracks?.length||!changedProjection?.tracks?.length)
      throw Error("empty MIDI projection "+seed);
  }
  const row={genre,seed,baselineHook:baselineHook.score,experimentalHook:proposedHook.score,hookDelta,
    originalCritic:originalCritic.score,experimentalCritic:changedCritic.score,
    criticDelta:Number((changedCritic.score-originalCritic.score).toFixed(3)),
    baselineRelease:baselineGate.passed,experimentalRelease:proposedGate.passed,
    noteChanges,midiExportVerified};
  rows.push(row);
  console.log("HOOK_OPENING_CASE",JSON.stringify(row));
 }
}
const summary={songs:rows.length,genres:genres.length,improved,worsened,unchanged,
 releaseRegressions,baselineChanges,mutatedMelody:rows.filter(r=>r.noteChanges.melody).length};
const report={version:1,experiment:"hookReturnOpeningGuardV1",defaultEnabled:false,summary,rows,
 limits:["No proof of audible melody improvement or device parity.",
   "Different stage phrasing can alter final authorized non-melody notes downstream; inspect each changed lane.",
   "Do not enable this option by default based on recurrence scores alone."]};
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2)+"\n");
console.log("HOOK_OPENING_SUMMARY",JSON.stringify(summary));
