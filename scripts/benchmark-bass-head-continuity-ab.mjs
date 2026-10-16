/** Test the existing Bass Continuity authority, not a competing generator. */
import fs from "node:fs/promises";
import path from "node:path";
import {
 generateNew,evaluateSongCandidate,evaluateSongReleaseGate,encodeMidiVerified,
} from "../src/music-engine.js";
import { createBassContinuityCandidates,analyzeBassContinuity } from "../src/core/bass-continuity-refinement.js";

const option=(flag,fallback)=>{const i=process.argv.indexOf(flag);return i<0?fallback:process.argv[i+1];};
const seedCount=Number(option("--seeds","2"));
if(!Number.isInteger(seedCount)||seedCount<1||seedCount>5)throw Error("seeds must be 1..5");
const out=path.resolve(option("--out","tmp/bass-head-continuity-ab"));
await fs.mkdir(out,{recursive:true});
const report={version:1,
 status:"developer-only, existing bass-continuity helper not activated in production",
 cases:[],summary:{songs:0,songsWithExistingCandidates:0,proposals:0,qualified:0,exportedPairs:0},
 limits:[
  "The original producer-intent sections and authorized rests remain important.",
  "A lower continuity gap score does not prove a danceable or better bassline.",
  "A MIDI import into FL Studio is not Android preview audio.",
  "Changing duration, timbre or note density globally without listening is prohibited.",
 ]};
const answer=[];
for(const genre of ["funk","neoSoul","hipHop"]){
 for(let i=1;i<=seedCount;i++){
  const seed="bass-head-census-"+genre+"-"+String(i).padStart(2,"0");
  const song=generateNew({genre,seed,bars:32,key:"E",scale:"minor",
    energy:0.68,complexity:0.62,variation:0.62,evolution:0.68,swing:0.14,humanize:0.12});
  const frozen=JSON.stringify((song.tracks??[]).map(t=>[t.id,t.notes]));
  const baseContinuity=analyzeBassContinuity(song);
  const baseEval=evaluateSongCandidate(song);
  const baseRelease=evaluateSongReleaseGate(song,baseEval);
  const candidates=createBassContinuityCandidates(song,{maxCandidates:2});
  if(candidates.length)report.summary.songsWithExistingCandidates++;
  report.summary.proposals+=candidates.length;
  const row={genre,seed,baselineContinuityDeficit:baseContinuity.deficit,
    baselineCritic:baseEval.score,baselineRelease:baseRelease.passed,
    proposed:[],blindPair:null};
  let selected=null;
  for(const proposal of candidates){
    const e=evaluateSongCandidate(proposal.song),g=evaluateSongReleaseGate(proposal.song,e);
    const bassOnly=(song.tracks??[]).every(t=>t.id==="bass"||
       JSON.stringify(t.notes)===JSON.stringify(proposal.song.tracks.find(x=>x.id===t.id)?.notes));
    if(!bassOnly)throw Error("continuity helper changed nonbass track: "+seed);
    const notesDelta=proposal.song.tracks.find(t=>t.id==="bass").notes.length-
      song.tracks.find(t=>t.id==="bass").notes.length;
    if(notesDelta!==proposal.changedNotes||notesDelta>3||notesDelta<1)
      throw Error("unsafe continuity note topology: "+seed);
    const continuous=analyzeBassContinuity(proposal.song);
    const protectedScores=Object.entries(baseEval.subscores??{}).every(([name,val])=>
      !Number.isFinite(val)||!Number.isFinite(e.subscores?.[name])||e.subscores[name]>=val);
    const eligible=Boolean(baseRelease.passed&&g.passed
      &&continuous.deficit<baseContinuity.deficit
      &&e.score>=baseEval.score&&protectedScores
      &&e.diagnostics?.scaleFit>=0.999999);
    const observation={id:proposal.id,addedNotes:notesDelta,
      deficitDelta:Number((continuous.deficit-baseContinuity.deficit).toFixed(4)),
      criticDelta:Number((e.score-baseEval.score).toFixed(3)),
      releasePassed:g.passed,protectedScoreRegression:!protectedScores,eligible};
    row.proposed.push(observation);
    if(eligible){
      report.summary.qualified++;
      if(!selected||observation.deficitDelta<selected.observation.deficitDelta)
        selected={proposal,observation};
    }
  }
  if(selected&&report.summary.exportedPairs<8){
    const base=encodeMidiVerified(song),experimental=encodeMidiVerified(selected.proposal.song);
    if(!base.audit?.passed||!experimental.audit?.passed)
      throw Error("export parity mismatch for "+seed);
    const id="bass-continuity-"+String(report.summary.exportedPairs+1).padStart(2,"0");
    const side=report.summary.exportedPairs%2===0?"A":"B",control=side==="A"?"B":"A";
    await fs.writeFile(path.join(out,id+"-"+side+".mid"),experimental.bytes);
    await fs.writeFile(path.join(out,id+"-"+control+".mid"),base.bytes);
    answer.push({id,genre,seed,treatment:side,control,proposalId:selected.proposal.id});
    row.blindPair=id;
    report.summary.exportedPairs++;
  }
  if(JSON.stringify((song.tracks??[]).map(t=>[t.id,t.notes]))!==frozen)
    throw Error("existing bass continuity audition mutated original "+seed);
  report.cases.push(row);
  console.log("BASS_CONTINUITY_CASE",JSON.stringify(row));
 }
}
report.summary.songs=report.cases.length;
await fs.writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2)+"\n");
await fs.writeFile(path.join(out,"answer-key.json"),JSON.stringify(answer,null,2)+"\n");
await fs.writeFile(path.join(out,"READ_FIRST.txt"),[
 "MIDI Arcade Bass Head — continuity repair using EXISTING authoritative candidate helper.",
 "Blind A/B: choose which bass grooves better, without knowing the changed version.",
 "Use the same DAW kick and bass presets, BPM, plugins, level and effect chain.",
 "Some rests may be intentional. Report unwanted crowding or diminished pocket.",
 "Only candidates that pass critic, release gate, and actual MIDI export are included.",
 "The default app and approved sound are unchanged.",
].join("\n")+"\n");
console.log("BASS_CONTINUITY_SUMMARY",JSON.stringify(report.summary));
