/** Developer-only Bass Head Groove Director audit on real seeded MIDI Arcade songs. */
import fs from "node:fs/promises";
import path from "node:path";
import { GENRE_PROFILES, generateNew, evaluateSongCandidate, evaluateSongReleaseGate } from "../src/music-engine.js";
import { inspectBassHeadGroove } from "./lib/bass-head-groove-census.mjs";
import { analyzeBassContinuity,createBassContinuityCandidates } from "../src/core/bass-continuity-refinement.js";
import { createGroovePocketCandidates } from "../src/core/groove-pocket-refinement.js";

const option=(key,fallback)=>{const i=process.argv.indexOf(key);return i===-1?fallback:process.argv[i+1];};
const integer=(value,key,max)=>{const i=Number(value);if(!Number.isSafeInteger(i)||i<1||i>max)throw new Error(key+" outside 1.."+max);return i;};
const names=option("--genres","trap,hipHop,neoSoul,funk,house,afrobeats,drill,rap,rnbSoul")
  .split(",").map(x=>x.trim()).filter(Boolean);
if(!names.length||names.some(x=>!(x in GENRE_PROFILES)))throw new Error("unknown genre");
const bars=integer(option("--bars","32"),"--bars",128);
const count=integer(option("--seeds","2"),"--seeds",6);
const dest=path.resolve(option("--out","tmp/bass-head-groove-report.json"));
const rows=[];
for(const genre of names){
  for(let i=1;i<=count;i++){
    const seed="bass-head-census-"+genre+"-"+String(i).padStart(2,"0");
    const config={genre,seed,bars,key:"E",scale:"minor",
      energy:0.68,complexity:0.62,variation:0.62,evolution:0.68,
      swing:0.14,humanize:0.12};
    const song=generateNew(config);
    const frozen=JSON.stringify((song.tracks??[]).map(t=>[t.id,t.notes]));
    const groove=inspectBassHeadGroove(song);
    const continuity=analyzeBassContinuity(song);
    const existingGrooveCandidates=createGroovePocketCandidates(song,{groovePocketRefinement:true});
    const existingContinuityCandidates=createBassContinuityCandidates(song,{maxCandidates:2});
    const judge=evaluateSongCandidate(song);
    const release=evaluateSongReleaseGate(song,judge);
    if(JSON.stringify((song.tracks??[]).map(t=>[t.id,t.notes]))!==frozen)
      throw Error("read-only Bass Head audit mutated authoritative song: "+seed);
    rows.push({
      genre,seed,bars,criticScore:judge.score,releasePassed:release.passed,
      groove,continuity:{
        deficit:Number(continuity.deficit.toFixed(3)),
        weakestSectionId:continuity.weakestSectionId,
        baselineAttacksPerBar:continuity.baselineAttacksPerBar,
      },
      existingCandidates:{
        groovePocket:existingGrooveCandidates.length,
        bassContinuity:existingContinuityCandidates.length,
      },
    });
    console.log("BASS_HEAD_CASE",JSON.stringify({
      genre,seed,bass:groove.sourceBassNotes,kicks:groove.sourceKickNotes,
      locked:groove.overall.lockedAttacks,offbeat:groove.overall.offbeatAttacks,
      overlaps:groove.overall.adjacentBassOverlaps,
      grooveCandidateCount:existingGrooveCandidates.length,
      continuityDeficit:continuity.deficit,
    }));
  }
}
const byGenre=names.map(genre=>{
  const songs=rows.filter(r=>r.genre===genre),sum=key=>songs.reduce((v,r)=>v+r.groove.overall[key],0);
  const bass=sum("bodyBassNotes"),offbeat=sum("offbeatAttacks");
  return {
    genre,songs:songs.length,bassNotes:bass,kickNotes:songs.reduce((v,r)=>v+r.groove.sourceKickNotes,0),
    kickLockedAttacks:sum("lockedAttacks"),offbeatAttacks:offbeat,
    offbeatFraction:bass?Number((offbeat/bass).toFixed(3)):null,
    bassOverlaps:sum("adjacentBassOverlaps"),
    songsWithPocketOptions:songs.filter(r=>r.existingCandidates.groovePocket>0).length,
    songsWithContinuityOptions:songs.filter(r=>r.existingCandidates.bassContinuity>0).length,
    failingRelease:songs.filter(r=>!r.releasePassed).length,
  };
});
const report={version:1,baseline:"unchanged generateNew() with fixed-seed genre configuration",
  scope:"developer-only; no candidate commits, note edits, renderer modifications or audio synth changes",
  summary:{songs:rows.length,genres:names.length,byGenre},rows,
  caveats:[
    "Bass offbeats relative to quarter-note grid are not automatically bad; tight locking is not automatically good.",
    "Proposed groove-pocket/continuity candidates are counted but NOT installed or release accepted.",
    "Kicks are GM pitches 35/36 only. A sampled one-shot kit may use different mapping.",
    "MIDI events cannot prove bass weight, perceived volume, phase cancellation, or Android speaker translation.",
    "No real audio playback or human danceability judgments were obtained.",
  ]};
await fs.mkdir(path.dirname(dest),{recursive:true});
await fs.writeFile(dest,JSON.stringify(report,null,2)+"\n");
console.log("BASS_HEAD_SUMMARY",JSON.stringify(report.summary));
