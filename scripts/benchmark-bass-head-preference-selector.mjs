/**
 * Bass Head Phase 3: holdout, preference-informed BLIND MIDI audition.
 * Source songs, kick patterns and approved synth engine remain untouched.
 * No runtime route, no new generator, no automatic candidate acceptance.
 *
 * node scripts/benchmark-bass-head-preference-selector.mjs
 *   --start 4 --seeds 6 --bars 32
 *   --out /tmp/bass-holdout.json --pack /tmp/bass-holdout-midi
 *   --key /tmp/bass-holdout-key.json
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
 generateNew,evaluateSongCandidate,evaluateSongReleaseGate,encodeMidiVerified,
} from "../src/music-engine.js";
import { createBassHeadBounceCandidates } from "../src/core/groove-pocket-refinement.js";
import { inspectBassHeadGroove } from "./lib/bass-head-groove-census.mjs";
import {
 summarizeBassHeadPreferences,planBassHeadAuditions,assessBassHeadCandidateSafety,
} from "./lib/bass-head-preference-selector.mjs";

const option=(name,fallback)=>{
 const pos=process.argv.indexOf(name);
 return pos>=0?process.argv[pos+1]:fallback;
};
function integerOption(name,fallback,max){
 const value=Number(option(name,fallback));
 if(!Number.isSafeInteger(value)||value<1||value>max)
  throw new RangeError(name+" must be an integer 1.."+max);
 return value;
}
const start=integerOption("--start","4",100);
const seeds=integerOption("--seeds","6",12);
const bars=integerOption("--bars","32",128);
if(start<4)throw new Error("Holdout seed index must be >= 4; do not retest training preferences as holdout");
const output=path.resolve(option("--out","tmp/bass-head-preference-holdout.json"));
const pack=path.resolve(option("--pack","tmp/bass-head-phase3-blind-midi"));
const keyPath=path.resolve(option("--key","tmp/bass-head-phase3-answer-key.json"));
if(keyPath===output||keyPath.startsWith(pack+path.sep)||output.startsWith(pack+path.sep))
 throw new Error("Store blind MIDI, diagnostic report, and answer key separately");
const feedbackPath=fileURLToPath(new URL("./fixtures/bass-head-listening-round-1.json",import.meta.url));
const feedback=JSON.parse(await fs.readFile(feedbackPath,"utf8"));
const learned=summarizeBassHeadPreferences(feedback);
const genres=["funk","neoSoul"];
const rows=[],answerKey=[],exported=[];
let pairIndex=0;

for(const genre of genres){
 for(let i=start;i<start+seeds;i++){
  const seed="bass-head-census-"+genre+"-"+String(i).padStart(2,"0");
  const song=generateNew({genre,seed,bars,key:"E",scale:"minor",
   energy:.68,complexity:.62,variation:.62,evolution:.68,swing:.14,humanize:.12});
  const beforeSnapshot=JSON.stringify(song.tracks);
  const beforeGroove=inspectBassHeadGroove(song);
  const beforeCritic=evaluateSongCandidate(song);
  const beforeRelease=evaluateSongReleaseGate(song,beforeCritic);
  const originalCandidates=createBassHeadBounceCandidates(song,{bassHeadBounceV1:true});
  const plan=planBassHeadAuditions(learned,genre,originalCandidates);
  if(beforeSnapshot!==JSON.stringify(song.tracks))throw new Error("Shadow candidate mutated baseline: "+seed);
  const row={genre,seed,originalBassNotes:beforeGroove.sourceBassNotes,
   baselineReleasePassed:beforeRelease.passed,
   baselineCriticScore:beforeCritic.score,
   auditioned:[],skippedByPreference:plan.skipped.map(c=>({id:c.id,tier:c.tier})),
   availableCandidates:originalCandidates.length};
  for(const {id,tier,candidate} of plan.auditions){
    const afterGroove=inspectBassHeadGroove(candidate.song);
    const afterCritic=evaluateSongCandidate(candidate.song);
    const afterRelease=evaluateSongReleaseGate(candidate.song,afterCritic);
    const result=assessBassHeadCandidateSafety({
      baseline:song,candidate:candidate.song,
      beforeCritic,afterCritic,beforeRelease,afterRelease,
      beforeGroove,afterGroove,
    });
    const attempt={id,tier,...result,
      proposalMovedNotes:candidate.changedNotes,
      beforeOffbeats:beforeGroove.overall.offbeatAttacks,
      afterOffbeats:afterGroove.overall.offbeatAttacks,
      blindId:null,exportVerified:false};
    if(result.eligible){
      const originalMidi=encodeMidiVerified(song);
      const candidateMidi=encodeMidiVerified(candidate.song);
      if(!originalMidi.audit.passed||!candidateMidi.audit.passed)
       throw new Error("Existing MIDI export parity failed: "+seed+"/"+id);
      attempt.exportVerified=true;
      if(pairIndex<12){
       pairIndex++;
       const blindId="bass-p3-"+String(pairIndex).padStart(2,"0");
       const experimentalInA=pairIndex%2===0;
       await fs.mkdir(pack,{recursive:true});
       await fs.writeFile(path.join(pack,blindId+"-A.mid"),
        experimentalInA?candidateMidi.bytes:originalMidi.bytes);
       await fs.writeFile(path.join(pack,blindId+"-B.mid"),
        experimentalInA?originalMidi.bytes:candidateMidi.bytes);
       answerKey.push({blindId,genre,seed,proposal:id,
        experimentalVersion:experimentalInA?"A":"B"});
       exported.push({blindId,genre,proposal:id});
       attempt.blindId=blindId;
      }
    }
    row.auditioned.push(attempt);
  }
  if(beforeSnapshot!==JSON.stringify(song.tracks))
   throw new Error("Holdout modified original MIDI song: "+seed);
  rows.push(row);
  console.log("BASS_HEAD_HOLDOUT_CASE",JSON.stringify({
   genre,seed,proposals:originalCandidates.length,
   auditioned:row.auditioned.length,eligible:row.auditioned.filter(x=>x.eligible).length,
   preferenceSkipped:row.skippedByPreference.length,
  }));
 }
}
const summary={
 songs:rows.length,
 auditioned:rows.reduce((s,r)=>s+r.auditioned.length,0),
 eligible:rows.reduce((s,r)=>s+r.auditioned.filter(a=>a.eligible).length,0),
 skippedByPreference:rows.reduce((s,r)=>s+r.skippedByPreference.length,0),
 auditionPairs:exported.length,
 byGenre:genres.map(genre=>{
  const scoped=rows.filter(r=>r.genre===genre);
  return {genre,songs:scoped.length,proposals:scoped.reduce((n,r)=>n+r.availableCandidates,0),
   auditioned:scoped.reduce((n,r)=>n+r.auditioned.length,0),
   eligible:scoped.reduce((n,r)=>n+r.auditioned.filter(a=>a.eligible).length,0),
   skipped:scoped.reduce((n,r)=>n+r.skippedByPreference.length,0)};
 })
};
const report={version:1,baselineCommit:"a3b1fd892058cd9a68a8d581d810bba431652cb9",
 mode:"holdout, read-only, listener-guided audition; default generation remains unchanged",
 feedback:{responses:learned.responses,uniqueSongs:learned.uniqueSongCount,
  experimentalWins:learned.experimentalWins,originalWins:learned.originalWins,groups:learned.groups},
 seedRange:{start,end:start+seeds-1},summary,rows,exported,
 caveats:[
  "Selections are a small single-listener preference sample; they do not train an audio model.",
  "Default generator remains authoritative and unchanged; the original is always available.",
  "A zero critic delta is not a perceived musical improvement.",
  "Safe and parity-verified MIDI is NOT a guarantee of improved bass sound.",
  "Blind listening is needed with matched DAW sound patches, gain and full-band mix.",
 ]};
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2)+"\n");
await fs.mkdir(path.dirname(keyPath),{recursive:true});
await fs.writeFile(keyPath,JSON.stringify({version:1,key:answerKey},null,2)+"\n");
await fs.mkdir(pack,{recursive:true});
await fs.writeFile(path.join(pack,"README.txt"),
 "Bass Head Phase 3: MIDI A/B blind listening.\nCompare matching -A.mid and -B.mid with the same FL Studio instruments and levels.\n" +
 "Do NOT inspect the separate answer key until after making selections.\nEach pair uses the same song seed and differs only in eligible bass timing.\n" +
 "These are MIDI-only experiments; no output changes to the Android app.\n");
console.log("BASS_HEAD_HOLDOUT_SUMMARY",JSON.stringify(summary));
