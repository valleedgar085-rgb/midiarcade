/**
 * Bass Head opt-in bounded candidate review, real 32-bar seeded songs.
 * No production path invokes this helper. Do not declare music improved
 * without blind same-preset A/B listening.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  generateNew,evaluateSongCandidate,evaluateSongReleaseGate,
  encodeMidiVerified,
} from "../src/music-engine.js";
import { createBassHeadBounceCandidates } from "../src/core/bass-head-bounce-candidates.js";

const opt=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const count=Number(opt("--seeds","3"));
if(!Number.isInteger(count)||count<1||count>5)throw Error("--seeds must be 1..5");
const out=path.resolve(opt("--out","tmp/bass-head-bounce-audit"));
await fs.mkdir(out,{recursive:true});
const report={version:1,mode:"candidate-only; production never enabled",
  provenance:"previous 18-song nine-genre bass/kick timing census",
  cases:[],summary:{songs:0,proposals:0,qualified:0,exportedPairs:0,releaseRegressions:0},
  limitations:[
    "An improved offbeat fraction is a symbolic rhythm observation, not proof of danceability.",
    "A passing release gate and equal critic score do not prove better bass.",
    "MIDI export parity is not actual Android audio playback.",
    "The original sample may be preferable to a groovier candidate; perform matched listening.",
  ],
};
const answerKeys=[];
for(const genre of ["funk","neoSoul"]){
 for(let i=1;i<=count;i++){
  const seed="bass-head-census-"+genre+"-"+String(i).padStart(2,"0");
  const song=generateNew({genre,seed,key:"E",scale:"minor",bars:32,
    energy:0.68,complexity:0.62,variation:0.62,evolution:0.68,swing:0.14,humanize:0.12});
  const frozen=JSON.stringify((song.tracks??[]).map(t=>[t.id,t.notes]));
  const baseCritic=evaluateSongCandidate(song),baseRelease=evaluateSongReleaseGate(song,baseCritic);
  const proposals=createBassHeadBounceCandidates(song);
  report.summary.proposals+=proposals.length;
  const row={genre,seed,baselineScore:baseCritic.score,baselineRelease:baseRelease.passed,
    proposals:[],exportedPair:null};
  let best=null;
  for(const candidate of proposals){
    const other=evaluateSongCandidate(candidate.song);
    const release=evaluateSongReleaseGate(candidate.song,other);
    const scoreDelta=Number((other.score-baseCritic.score).toFixed(3));
    const rootSafe=other.diagnostics?.scaleFit>=0.999999;
    const noReleaseRegression=baseRelease.passed&&release.passed;
    const safe=noReleaseRegression&&scoreDelta>=0&&rootSafe;
    if(baseRelease.passed&&!release.passed)report.summary.releaseRegressions++;
    const observation={id:candidate.id,changedNotes:candidate.changedNotes,
      offbeatDelta:candidate.offbeatDelta,scoreDelta,
      releasePassed:release.passed,scaleFit:other.diagnostics?.scaleFit??null,
      qualified:safe};
    row.proposals.push(observation);
    if(safe){
      // MIDI encoding is the authoritative parity check.
      const control=encodeMidiVerified(song),experimental=encodeMidiVerified(candidate.song);
      if(!control.audit?.passed||!experimental.audit?.passed)
        throw Error("MIDI export parity failed: "+seed);
      report.summary.qualified++;
      if(!best||observation.offbeatDelta>best.observation.offbeatDelta)
        best={candidate,observation,control,experimental};
    }
  }
  if(best&&report.summary.exportedPairs<8){
    const id="bass-head-"+String(report.summary.exportedPairs+1).padStart(2,"0");
    const shiftedLeft=(report.summary.exportedPairs%2)===0;
    const experimentalSide=shiftedLeft?"A":"B",controlSide=shiftedLeft?"B":"A";
    await fs.writeFile(path.join(out,id+"-"+experimentalSide+".mid"),best.experimental.bytes);
    await fs.writeFile(path.join(out,id+"-"+controlSide+".mid"),best.control.bytes);
    row.exportedPair=id;
    answerKeys.push({id,genre,seed,treatment:experimentalSide,control:controlSide,proposal:best.observation.id});
    report.summary.exportedPairs++;
  }
  if(JSON.stringify((song.tracks??[]).map(t=>[t.id,t.notes]))!==frozen)
    throw Error("bass candidate audit mutated committed song: "+seed);
  report.cases.push(row);
  console.log("BASS_HEAD_BOUNCE_CASE",JSON.stringify(row));
 }
}
report.summary.songs=report.cases.length;
await fs.writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2)+"\n");
await fs.writeFile(path.join(out,"answer-key.json"),JSON.stringify(answerKeys,null,2)+"\n");
await fs.writeFile(path.join(out,"READ_FIRST.txt"),[
  "MIDI Arcade Bass Head Bounce opt-in candidate A/B",
  "Use identical kick and bass sounds, BPM, output gain and effects.",
  "Rate groove, body movement, kick attack and vocal space BEFORE reading the answer key.",
  "The default MIDI Arcade generator and existing approved sound were not changed.",
  "If no MIDI files exist, no real song proposal cleared the strict gates.",
].join("\n")+"\n");
console.log("BASS_HEAD_BOUNCE_SUMMARY",JSON.stringify(report.summary));
