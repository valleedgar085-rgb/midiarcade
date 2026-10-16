import fs from "node:fs/promises";
import path from "node:path";
/** Read-only bass-head kick/bass pocket audit. No production note mutations. */
import { GENRE_PROFILES, generateNew } from "../src/music-engine.js";
import { analyzeBassPocket } from "./lib/bass-head-pocket.mjs";

const args = process.argv;
function arg(name, fallback) { const i=args.indexOf(name); return i<0?fallback:args[i+1]; }
const genres=arg("--genres","trap,hipHop,funk,neoSoul,house,afrobeats").split(",").map(x=>x.trim());
const seeds=Number(arg("--seeds","2"));
const bars=Number(arg("--bars","32"));
if(!Number.isSafeInteger(seeds)||seeds<1||seeds>12)throw Error("--seeds must be 1..12");
if(!Number.isSafeInteger(bars)||bars<4||bars>128)throw Error("--bars must be 4..128");
if(genres.some(g=>!Object.hasOwn(GENRE_PROFILES,g)))throw Error("Unknown genre: "+genres.join(","));
const jsonOutput=arg("--json",null);
const results=[];
for(const genre of genres)for(let i=1;i<=seeds;i++){
 const seed="bass-head-"+String(i).padStart(2,"0")+"-"+genre;
 const song=generateNew({genre,seed,key:"E",scale:"minor",bars,energy:.68,complexity:.62,variation:.62,evolution:.68,swing:.14,humanize:.12});
 const snapshot=JSON.stringify(song.tracks);
 const metrics=analyzeBassPocket(song);
 if(JSON.stringify(song.tracks)!==snapshot)throw Error("Audit mutated "+genre+"/"+seed);
 results.push({genre,seed,...metrics});
 console.log("BASS_HEAD_CASE "+JSON.stringify(results.at(-1)));
}
const withKick=results.filter(x=>x.kickCount>0&&x.bassCount>0);
const summary = {cases:results.length,withKick:withKick.length,missingBass:results.filter(x=>!x.bassCount).length,medianLockedRatio:median(withKick.map(x=>x.lockedRatio)),medianOffbeatRatio:median(withKick.map(x=>x.offbeatRatio)),medianSubOverlapRatio:median(withKick.map(x=>x.overlapRatio)),weakest:withKick.slice().sort((a,b)=>a.lockedRatio-b.lockedRatio).slice(0,6).map(x=>({genre:x.genre,seed:x.seed,lockedRatio:x.lockedRatio,offbeatRatio:x.offbeatRatio}))};
console.log("BASS_HEAD_SUMMARY "+JSON.stringify(summary));
if(jsonOutput){
 const full=path.resolve(jsonOutput);
 await fs.mkdir(path.dirname(full),{recursive:true});
 await fs.writeFile(full,JSON.stringify({
  mode:"read-only",version:2,summary,rows:results,
  interpretation:"Kick-lock and offbeat percentages are descriptive, not quality scores. Intentional rests, anticipations and genre pocket must be reviewed.",
  baseline:"Generated in Node CI, not Android audio playback; no note events changed",
 },null,2)+"\n");
}
function median(v){if(!v.length)return null;const a=v.slice().sort((x,y)=>x-y);return Number(((a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2).toFixed(3));}
