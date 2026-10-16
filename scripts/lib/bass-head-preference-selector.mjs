/**
 * Bass Head Phase 3: developer-only listening evidence and shadow audition plan.
 * Not imported by Android, generateNew(), quality pipeline, or any runtime UI.
 * Listening preferences prioritize comparisons; they never commit a bass edit.
 */
const GENRES=new Set(["funk","neoSoul"]);
const KNOWN_PROPOSALS=new Set(["bass-head-answer-quarter","bass-head-pickup-quarter"]);
const PRIORITY=Object.freeze({"priority-review":0,"collect-more":1,"unseen":2,"prefer-baseline":3});
const round=(v,n=3)=>Number(v.toFixed(n));

/**
 * Convert blind A/B votes to ORIGINAL vs EXPERIMENTAL, with independent-song
 * counts. One user and five comparisons cannot establish general preference.
 */
export function summarizeBassHeadPreferences(feedback){
 const rows=feedback?.choices;
 if(!Array.isArray(rows)||rows.length===0)throw new TypeError("Nonempty blind choices required");
 const seenIds=new Set(),uniqueSongs=new Set(),groups=new Map();
 let experimentalWins=0,originalWins=0;
 for(const row of rows){
   const {blindId,genre,seed,proposal,experimentalVersion,preferredVersion}=row??{};
   if(typeof blindId!=="string"||!blindId.trim()
     ||typeof genre!=="string"||!genre.trim()||typeof seed!=="string"||!seed.trim()
     ||typeof proposal!=="string"||!proposal.trim())
     throw new TypeError("Blind preference needs blindId, genre, seed and proposal");
   if(seenIds.has(blindId))throw new Error("Duplicate blind ID: "+blindId);
   seenIds.add(blindId);
   if(!["A","B"].includes(experimentalVersion)||!["A","B"].includes(preferredVersion))
     throw new Error("experimentalVersion and preferredVersion must be A or B");
   if(!GENRES.has(genre)||!KNOWN_PROPOSALS.has(proposal))
     throw new Error("Unknown audition genre/proposal: "+genre+"/"+proposal);
   const preferredExperiment=preferredVersion===experimentalVersion;
   experimentalWins+=Number(preferredExperiment);
   originalWins+=Number(!preferredExperiment);
   uniqueSongs.add(genre+"|"+seed);
   const key=genre+"|"+proposal;
   if(!groups.has(key))groups.set(key,{genre,proposal,
     experimentalWins:0,originalWins:0,winSeeds:new Set(),lossSeeds:new Set()});
   const group=groups.get(key);
   if(preferredExperiment){
     group.experimentalWins++;
     group.winSeeds.add(seed);
   }else{
     group.originalWins++;
     group.lossSeeds.add(seed);
   }
 }
 const compact=[...groups.values()].map(group=>{
  const independentWinningSongs=group.winSeeds.size;
  const independentLosingSongs=group.lossSeeds.size;
  const tier=independentWinningSongs>=2&&group.originalWins===0?"priority-review"
   :independentLosingSongs>=2&&group.experimentalWins===0?"prefer-baseline"
   :"collect-more";
  return {genre:group.genre,proposal:group.proposal,
    experimentalWins:group.experimentalWins,originalWins:group.originalWins,
    independentWinningSongs,independentLosingSongs,tier};
 }).sort((a,b)=>a.genre.localeCompare(b.genre)||a.proposal.localeCompare(b.proposal));
 return Object.freeze({
  version:1,responses:rows.length,experimentalWins,originalWins,
  uniqueSongCount:uniqueSongs.size,groups:compact,defaultActivationAllowed:false,
  caveat:"One listener, a tiny shared-seed sample; ranks future auditions, never automatic changes",
 });
}

/** Rank *which existing safe proposals to audition*, not which notes to ship. */
export function planBassHeadAuditions(preferences,genre,candidates=[]){
 const result={genre,baseline:"original",auditions:[],skipped:[],defaultActivationAllowed:false};
 if(!GENRES.has(genre))return result;
 const groups=preferences?.groups??[];
 const seen=new Set();
 for(const candidate of candidates){
  const id=candidate?.id;
  if(!KNOWN_PROPOSALS.has(id)||seen.has(id))continue;
  seen.add(id);
  const match=groups.find(group=>group.genre===genre&&group.proposal===id);
  const tier=match?.tier??"unseen";
  const entry={id,tier,
    experimentalWins:match?.experimentalWins??0,originalWins:match?.originalWins??0,
    independentWinningSongs:match?.independentWinningSongs??0,
    independentLosingSongs:match?.independentLosingSongs??0,
    candidate};
  if(tier==="prefer-baseline")result.skipped.push(entry);
  else result.auditions.push(entry);
 }
 result.auditions.sort((a,b)=>PRIORITY[a.tier]-PRIORITY[b.tier]||a.id.localeCompare(b.id));
 return result;
}

function noteStart(note){
 const v=note?.start??note?.startBeat??note?.beat??note?.time;
 return typeof v==="number"&&Number.isFinite(v)?v:null;
}
function signature(note){
 // The bounce helper is authorized to move onsets and add only these tags.
 const safe={...note};
 for(const k of ["start","startBeat","beat","time",
   "bassHeadBounceRole","bassHeadBounceSectionId"])delete safe[k];
 const fields=Object.keys(safe).sort();
 return JSON.stringify(fields.map(k=>[k,safe[k]]));
}
function compareBassNotes(before,after){
 if(!Array.isArray(before)||!Array.isArray(after)||before.length!==after.length)
  return {passed:false,changedNotes:0};
 const matchGroup=(notes)=>{
  const groups=new Map();
  for(const note of notes){
   const time=noteStart(note);
   if(time===null)return null;
   const key=signature(note);
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(time);
  }
  for(const values of groups.values())values.sort((a,b)=>a-b);
  return groups;
 };
 const source=matchGroup(before),target=matchGroup(after);
 if(!source||!target||source.size!==target.size)return {passed:false,changedNotes:0};
 let changedNotes=0;
 for(const [key,oldTimes] of source){
  const newTimes=target.get(key);
  if(!newTimes||oldTimes.length!==newTimes.length)return {passed:false,changedNotes:0};
  // Sorted matching is deterministic and minimizes cumulative move distance
  // for identical pitch/duration/velocity note-signatures.
  for(let i=0;i<oldTimes.length;i++){
   const delta=Math.abs(oldTimes[i]-newTimes[i]);
   if(delta>0.250001)return {passed:false,changedNotes:0};
   if(delta>0.000001)changedNotes++;
  }
 }
 return {passed:changedNotes>0,changedNotes};
}

/**
 * Structural/critic gate on an opt-in candidate before producing a listening
 * comparison. The benchmark performs actual encodeMidiVerified parity after
 * this stage; this function does not declare musical superiority.
 */
export function assessBassHeadCandidateSafety({
 baseline,candidate,beforeCritic,afterCritic,beforeRelease,afterRelease,
 beforeGroove,afterGroove,
}={}){
 const reasons=[];
 const before=baseline?.tracks,after=candidate?.tracks;
 const stable=Array.isArray(before)&&Array.isArray(after)
   &&before.length===after.length
   &&before.every((t,i)=>String(t.id)===String(after[i]?.id));
 if(!stable)reasons.push("track-roster-changed");
 const originalBass=before?.find(t=>t.id==="bass")?.notes;
 const proposedBass=after?.find(t=>t.id==="bass")?.notes;
 const others=stable&&before.every((t,i)=>t.id==="bass"||JSON.stringify(t)===JSON.stringify(after[i]));
 if(!others)reasons.push("nonbass-track-changed");
 const notes=compareBassNotes(originalBass,proposedBass);
 if(!notes.passed)reasons.push("bass-timbre-topology-or-shift-changed");
 const origScore=beforeCritic?.score,changedScore=afterCritic?.score;
 const criticSafe=typeof origScore==="number"&&Number.isFinite(origScore)
   &&typeof changedScore==="number"&&Number.isFinite(changedScore)
   &&changedScore>=origScore-.01;
 if(!criticSafe)reasons.push("critic-score-regression");
 if(beforeRelease?.passed!==true||afterRelease?.passed!==true)reasons.push("release-gate");
 const previous=beforeGroove?.overall,now=afterGroove?.overall;
 if(!(Number.isFinite(previous?.lockedAttacks)&&previous.lockedAttacks===now?.lockedAttacks))
  reasons.push("kick-lock-changed");
 if(!(Number.isFinite(previous?.adjacentBassOverlaps)
   &&Number.isFinite(now?.adjacentBassOverlaps)
   &&now.adjacentBassOverlaps<=previous.adjacentBassOverlaps))
  reasons.push("bass-overlap-increased");
 if(!(Number.isFinite(previous?.offbeatAttacks)
   &&Number.isFinite(now?.offbeatAttacks)
   &&now.offbeatAttacks>previous.offbeatAttacks))
  reasons.push("no-offbeat-development");
 return {
  eligible:reasons.length===0,reasons,changedNotes:notes.changedNotes,
  criticDelta:criticSafe?round(changedScore-origScore):null,
  requiresMidiParity:true,requiresBlindListening:true,
  defaultActivationAllowed:false,
 };
}
