/** Fixed-seed, read-only hook lineage census (no WebAudio or new composer). */
import fs from "node:fs/promises";
import path from "node:path";
import { GENRE_PROFILES, generateNew } from "../src/music-engine.js";
import { inspectHookLineage } from "./lib/hook-lineage-audit.mjs";

function option(name, fallback){const at=process.argv.indexOf(name);return at<0?fallback:process.argv[at+1];}
function integer(value,name,max){const n=Number(value);if(!Number.isInteger(n)||n<1||n>max)throw Error(name+" outside 1.."+max);return n;}
const genres=option("--genres",Object.keys(GENRE_PROFILES).join(",")).split(",").map(s=>s.trim()).filter(Boolean);
if(!genres.length||genres.some(x=>!(x in GENRE_PROFILES)))throw Error("unknown genre");
const seeds=integer(option("--seeds","2"),"--seeds",8);
const bars=integer(option("--bars","32"),"--bars",128);
const output=option("--out","tmp/hook-lineage.json");
const rows=[];
for(const genre of genres){
  for(let i=1;i<=seeds;i++){
    const seed="census-"+String(i).padStart(2,"0")+"-"+genre;
    const config={genre,seed,bars,key:"E",scale:"minor",energy:0.68,
      complexity:0.62,variation:0.62,evolution:0.68,swing:0.14,humanize:0.12};
    const song=generateNew(config);
    const before=JSON.stringify((song.tracks??[]).map(t=>[t.id,t.notes]));
    const report=inspectHookLineage(song);
    if(JSON.stringify((song.tracks??[]).map(t=>[t.id,t.notes]))!==before)
      throw Error("lineage audit mutated a song: "+seed);
    rows.push({genre,seed,...report});
    console.log("HOOK_LINEAGE_CASE",JSON.stringify({genre,seed,status:report.hookStatus,
      score:report.hookScore,issues:report.returns.map(r=>r.issue)}));
  }
}
const returns=rows.flatMap(row=>row.returns.map(x=>({...x,genre:row.genre,seed:row.seed})));
const issueCounts={};
for(const row of returns)issueCounts[row.issue]=(issueCounts[row.issue]??0)+1;
const report={
  version:1,scope:"developer-only, no MIDI notes changed",
  summary:{
    songs:rows.length,genres:genres.length,totalReturningChoruses:returns.length,
    weakEvaluableReturns:returns.filter(r=>r.hookScore!==null&&r.hookScore<66).length,
    issueCounts,
  },
  rows,limits:[
    "Equal upstream motif family does not guarantee matching produced pitches.",
    "Downstream note-identity drift is a classification, not proof which specific stage changed notes.",
    "Source chorus may be missing, shortened or intentionally syncopated; unavailable comparisons are not failures.",
    "This report does not measure listening quality or device-audio behavior.",
  ],
};
await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2)+"\n");
console.log("HOOK_LINEAGE_SUMMARY",JSON.stringify(report.summary));
