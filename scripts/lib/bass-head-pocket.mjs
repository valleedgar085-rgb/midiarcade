/** Read-only MIDI bass pocket statistics. Values are descriptive, not music quality scores. */
const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const at=note=>n(note?.start??note?.startBeat??note?.beat??note?.time);
const pitch=note=>n(note?.pitch??note?.note??note?.midi,-1);
const dur=note=>Math.max(0,n(note?.duration??note?.durationBeats??note?.length));
const r=v=>Number(v.toFixed(3));
export function analyzeBassPocket(song){
 const tracks=song?.tracks??[];
 const bass=tracks.find(t=>t.id==="bass")?.notes??[];
 const drums=tracks.find(t=>t.id==="drums")?.notes??[];
 const kicks=drums.filter(x=>[35,36].includes(pitch(x))).map(at).sort((a,b)=>a-b);
 const starts=bass.map(at).sort((a,b)=>a-b);
 const bpm=Math.max(1,n(song?.meta?.bpm??song?.bpm,120));
 const epsilon=.075;
 const near=(a,b)=>Math.abs(a-b)<=epsilon;
 const locked=starts.filter(x=>kicks.some(k=>near(x,k))).length;
 const offbeat=starts.filter(x=>{const fractional=((x%1)+1)%1;return near(fractional,.5)||near(fractional,.25)||near(fractional,.75);}).length;
 const overlap=bass.filter((note,i)=>bass.some((other,j)=>j!==i&&at(other)>at(note)&&at(other)<at(note)+dur(note)-1e-6)).length;
 const nearest=starts.map(x=>kicks.length?kicks.reduce((best,k)=>Math.abs(k-x)<Math.abs(best-x)?k:best,kicks[0]):null).filter(x=>x!==null);
 const deltas=starts.slice(0,nearest.length).map((x,i)=>r((x-nearest[i])*60000/bpm));
 const beatsPerBar=Math.max(1,n(song?.meta?.beatsPerBar,4));
 const uniqueBarCells=new Set(starts.map(x=>r(((x%beatsPerBar)+beatsPerBar)%beatsPerBar)));
 return {bassCount:bass.length,kickCount:kicks.length,lockedCount:locked,lockedRatio:bass.length?r(locked/bass.length):0,offbeatCount:offbeat,offbeatRatio:bass.length?r(offbeat/bass.length):0,overlapCount:overlap,overlapRatio:bass.length?r(overlap/bass.length):0,distinctWithinBarPositions:uniqueBarCells.size,medianNearestKickDeltaMs:deltas.length?median(deltas):null,tempoBpm:bpm};
}
function median(v){const a=v.slice().sort((x,y)=>x-y);return r((a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2);}
