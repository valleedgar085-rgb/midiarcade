/**
 * Developer-only, fixed-seed shadow evaluation of one-onset-per-two-bars
 * Funk/Neo-Soul bass answers. Never routes to production generation.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  generateNew, evaluateSongCandidate, evaluateSongReleaseGate,
  encodeMidiVerified,
} from "../src/music-engine.js";
import { inspectBassHeadGroove } from "./lib/bass-head-groove-census.mjs";
import { createBassHeadBounceCandidates } from "../src/core/groove-pocket-refinement.js";

function flag(name,fallback){const index=process.argv.indexOf(name);return index<0?fallback:process.argv[index+1];}
function safeInt(n,name,max){const value=Number(n);if(!Number.isInteger(value)||value<1||value>max)throw Error(name+" outside 1.."+max);return value;}
const seeds=safeInt(flag("--seeds","3"),"seeds",6);
const bars=safeInt(flag("--bars","32"),"bars",128);
const genres=flag("--genres","funk,neoSoul").split(",").map(x=>x.trim()).filter(Boolean);
if(genres.length===0||genres.some(x=>!["funk","neoSoul"].includes(x)))throw Error("Only funk and neoSoul supported");
const output=path.resolve(flag("--out","tmp/bass-head-bounce-shadow.json"));
const pack=path.resolve(flag("--pack","tmp/bass-head-bounce-listen"));
const answerKey=path.resolve(flag("--key","tmp/bass-head-bounce-answer-key.json"));
if(answerKey===output||answerKey.startsWith(pack+path.sep))throw Error("Answer key must be kept separate from blind pack");
const rows=[], blindPairs=[],keys=[];
let acceptedPairs=0;
const checkedOtherTracks=(a,b)=>
  ["drums","chords","melody","counterpoint","pad"].every(id=>
    JSON.stringify(a.tracks.find(t=>t.id===id)?.notes??[])===
    JSON.stringify(b.tracks.find(t=>t.id===id)?.notes??[]));
for(const genre of genres){
  for(let i=1;i<=seeds;i++){
    const seed="bass-head-census-"+genre+"-"+String(i).padStart(2,"0");
    const config={genre,seed,bars,key:"E",scale:"minor",
      energy:0.68,complexity:0.62,variation:0.62,evolution:0.68,
      swing:0.14,humanize:0.12,
    };
    const baseline=generateNew(config);
    const snapshot=JSON.stringify(baseline.tracks);
    const initial=inspectBassHeadGroove(baseline);
    const originalScore=evaluateSongCandidate(baseline);
    const originalGate=evaluateSongReleaseGate(baseline,originalScore);
    const candidates=createBassHeadBounceCandidates(baseline,{bassHeadBounceV1:true});
    if(snapshot!==JSON.stringify(baseline.tracks))throw Error("Read-only proposal mutated original "+seed);
    const row={genre,seed,candidates:candidates.length,initialOffbeats:initial.overall.offbeatAttacks,
      baselineCritic:originalScore.score,baselineRelease:originalGate.passed,attempts:[]};
    for(const proposal of candidates){
      const next=proposal.song;
      const groove=inspectBassHeadGroove(next);
      const critic=evaluateSongCandidate(next);
      const release=evaluateSongReleaseGate(next,critic);
      const unchangedOthers=checkedOtherTracks(baseline,next);
      const preservedLocks=groove.overall.lockedAttacks===initial.overall.lockedAttacks;
      const preservedOverlap=groove.overall.adjacentBassOverlaps<=initial.overall.adjacentBassOverlaps;
      const criticDelta=Number((critic.score-originalScore.score).toFixed(3));
      const eligible=Boolean(unchangedOthers&&preservedLocks&&preservedOverlap
        &&originalGate.passed&&release.passed&&criticDelta>=-0.5
        &&groove.overall.offbeatAttacks>initial.overall.offbeatAttacks);
      const attempted={id:proposal.id,changedNotes:proposal.changedNotes,
        offbeatDelta:proposal.offbeatDelta,criticDelta,
        releasePassed:release.passed,releaseFailures:release.failures??[],
        unchangedOthers,preservedLocks,preservedOverlap,eligible,
        verifiedExport:false,blindId:null};
      if(eligible){
        const oldMidi=encodeMidiVerified(baseline);
        const newMidi=encodeMidiVerified(next);
        if(!oldMidi.audit.passed||!newMidi.audit.passed)throw Error("export parity fail "+seed);
        attempted.verifiedExport=true;
        // Deterministic assignment for blind review, never sourced from Math.random.
        if(acceptedPairs<8){
          const blindId="bass-"+String(acceptedPairs+1).padStart(2,"0");
          const swapped=(acceptedPairs+genre.length)%2===1;
          await fs.mkdir(pack,{recursive:true});
          await fs.writeFile(path.join(pack,blindId+"-A.mid"),swapped?newMidi.bytes:oldMidi.bytes);
          await fs.writeFile(path.join(pack,blindId+"-B.mid"),swapped?oldMidi.bytes:newMidi.bytes);
          keys.push({blindId,genre,seed,proposal:proposal.id,experimentalVersion:swapped?"A":"B"});
          blindPairs.push(blindId);
          attempted.blindId=blindId;
          acceptedPairs++;
        }
      }
      row.attempts.push(attempted);
    }
    rows.push(row);
    console.log("BASS_HEAD_BOUNCE_CASE",JSON.stringify({genre,seed,
      candidates:row.candidates,qualified:row.attempts.filter(x=>x.eligible).length,
      changes:row.attempts.map(x=>({id:x.id,offbeats:x.offbeatDelta,critic:x.criticDelta}))}));
  }
}
const summary={
  songs:rows.length,proposals:rows.reduce((n,r)=>n+r.candidates,0),
  eligible:rows.reduce((n,r)=>n+r.attempts.filter(a=>a.eligible).length,0),
  rejected:rows.reduce((n,r)=>n+r.attempts.filter(a=>!a.eligible).length,0),
  withProposals:rows.filter(r=>r.candidates>0).length,blindPairs:blindPairs.length,
};
const report={version:1,mode:"read-only opt-in shadow, NEVER enabled by default",
  summary,rows,blindPairs,qualifications:[
    "A successful MIDI export and critic gate does NOT prove listener-rated bounce.",
    "A quarter-beat anticipation or answer can feel less groovy than the original; compare blind.",
    "No drums, chords, melody, counterpoint, pad, presets or playback assets were modified.",
    "Only fixed-seed Funk and Neo-Soul tests run; other genre default behavior unchanged.",
  ]};
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2)+"\n");
await fs.mkdir(path.dirname(answerKey),{recursive:true});
await fs.writeFile(answerKey,JSON.stringify({version:1,keys},null,2)+"\n");
console.log("BASS_HEAD_BOUNCE_SUMMARY",JSON.stringify(summary));
