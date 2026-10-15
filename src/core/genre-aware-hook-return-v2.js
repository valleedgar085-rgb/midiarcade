import { cloneValue } from "./clone-value.js";
import { evaluateChorusHookRecurrence } from "./chorus-hook-recurrence.js";
import { rolePreferredRegisterWindow } from "./role-register-policy.js";

/**
 * Candidate-only, genre-aware hook-return contour recall.
 * This helper does NOT run during default generation or commit a new song.
 * All stochastic authority remains in the existing engine and worker.
 */
export const GENRE_HOOK_RETURN_V2 = Object.freeze([
  "neoSoul", "rnbSoul", "popRadio", "afrobeats", "funk", "synthwave",
  "synthPopRadio", "loFiHipHop", "hipHop", "rap", "pop", "drill",
]);
export const MAX_HOOK_RETURN_V2_CANDIDATES = 3;
const genreSet = new Set(GENRE_HOOK_RETURN_V2);
const forbiddenRoles = new Set([
  "motif-core", "memory-landing", "cadential-landing", "motif-recall-anchor",
]);
const finite = (v,fallback=NaN) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const mod12 = n => ((Math.round(n)%12)+12)%12;
const round = n => Math.round(n*1000)/1000;

function protectedNote(note){
  return Boolean(note?.motifMemoryCore || note?.ensembleCadenceRole
    || note?.transitionHandoffRole || note?.motifHandoffRole
    || note?.finalAssemblyRole || note?.phraseRole==="turnaround"
    || forbiddenRoles.has(String(note?.phraseIntentRole))
    || forbiddenRoles.has(String(note?.sectionDevelopmentRole)));
}
function sectionById(song,id){
  return (song?.structure??song?.sections??[]).find(section=>String(section?.id)===String(id));
}
function sectionStart(song,section){
  return finite(section?.startBeat,finite(section?.startBar,0)*Math.max(1,finite(song?.meta?.beatsPerBar,4)));
}
function opening(song,id,bars) {
  const section=sectionById(song,id);
  const track=(song?.tracks??[]).find(t=>t?.id==="melody");
  if(!section||!track)return [];
  const start=sectionStart(song,section),end=start+bars*Math.max(1,finite(song?.meta?.beatsPerBar,4));
  return (track.notes??[]).map((note,index)=>({note,index}))
    .filter(({note})=>finite(note?.start,-1)>=start-1e-6&&finite(note?.start,-1)<end-1e-6)
    .sort((a,b)=>finite(a.note.start,0)-finite(b.note.start,0)||finite(a.note.pitch,0)-finite(b.note.pitch,0))
    .slice(0,12);
}
function keyAuthority(song){
  const key=finite(song?.meta?.keyPc);
  const intervals=song?.meta?.scaleIntervals;
  if(!Number.isInteger(key)||!Array.isArray(intervals)||!intervals.length)return null;
  const steps=intervals.map(Number);
  if(steps.some(step=>!Number.isInteger(step)||step<0||step>11))return null;
  return new Set(steps.map(step=>mod12(key+step)));
}
function intentPitches(source,index,target){
  const previous=source[index-1]?.note;
  const current=source[index]?.note;
  const following=source[index+1]?.note;
  const currentTarget=target[index]?.note;
  const previousTarget=target[index-1]?.note;
  const nextTarget=target[index+1]?.note;
  if(!previous||!current||!following||!currentTarget||!previousTarget||!nextTarget)return [];
  const original=finite(currentTarget.pitch);
  const desiredInterval=finite(current.pitch)-finite(previous.pitch);
  const outgoing=finite(following.pitch)-finite(current.pitch);
  if(!Number.isInteger(original)||Math.abs(desiredInterval)>9||Math.abs(outgoing)>9)return [];
  return [
    // Preserve the returning phrase's register and reintroduce familiar motion.
    finite(previousTarget.pitch)+desiredInterval,
    // Retain one recognizable melodic note when the original register permits it.
    finite(current.pitch),
    // A gentle echo of the melodic motion leading into the next note.
    finite(nextTarget.pitch)-outgoing,
  ];
}
/**
 * Translate an interval-contour target onto the actual key/scale *before*
 * measuring the proposed edit. Do not assume that raw interval arithmetic
 * lands inside a legal scale or invent any extra MIDI notes.
 */
function scaleProjectedPitches(source, index, target, classes, window) {
  const current=finite(target[index]?.note?.pitch);
  if(!Number.isInteger(current))return [];
  const ideals=intentPitches(source,index,target).filter(Number.isFinite);
  if(!ideals.length)return [];
  const possible=[];
  for(let pitch=Math.max(window.min,current-6);pitch<=Math.min(window.max,current+6);pitch++){
    if(pitch===current||!classes.has(mod12(pitch)))continue;
    const contourDistance=Math.min(...ideals.map(ideal=>Math.abs(pitch-ideal)));
    if(contourDistance>3)continue;
    possible.push({pitch,contourDistance,change:Math.abs(pitch-current)});
  }
  return possible.sort((a,b)=>a.contourDistance-b.contourDistance
    ||a.change-b.change||a.pitch-b.pitch).slice(0,8).map(entry=>entry.pitch);
}

function allowedPitch(source, target, index, pitch, classes, window) {
  const current=target[index]?.note;
  const prev=target[index-1]?.note;
  const next=target[index+1]?.note;
  if(!current||!prev||!next)return false;
  const original=finite(current.pitch),candidate=Math.round(pitch);
  if(!Number.isInteger(original)||!Number.isInteger(candidate))return false;
  if(candidate===original||Math.abs(candidate-original)>6
    ||candidate<window.min||candidate>window.max
    ||!classes.has(mod12(candidate)))return false;
  // Avoid unprepared, abrupt melodic zigzags in either direction.
  const entry=finite(prev.pitch),exit=finite(next.pitch);
  if(!Number.isFinite(entry)||!Number.isFinite(exit)
    ||Math.abs(candidate-entry)>9||Math.abs(exit-candidate)>9)return false;
  const now=finite(current.start),start=finite(prev.start),end=finite(next.start);
  if(!Number.isFinite(now)||!(start<now&&now<end))return false;
  return true;
}

/**
 * Ask the EXISTING hook recurrence critic for bounded 1-note candidates.
 * Preserve the original song, verse, timing, dynamics, track order and anchors.
 * Score wins are only a hypothesis: downstream release, MIDI export and
 * controlled listening must validate any optional promoted candidate.
 */
export function createGenreAwareHookReturnCandidates(song,{
  maxCandidates=MAX_HOOK_RETURN_V2_CANDIDATES,
}={}){
  const genre=String(song?.meta?.genre??song?.genre??"");
  if(!genreSet.has(genre))return [];
  const limit=Math.max(0,Math.min(MAX_HOOK_RETURN_V2_CANDIDATES,
    Math.floor(finite(maxCandidates,MAX_HOOK_RETURN_V2_CANDIDATES))));
  if(!limit)return [];
  const classes=keyAuthority(song);
  if(!classes)return [];
  const baseline=evaluateChorusHookRecurrence(song);
  if(baseline.status!=="evaluated"||!Number.isFinite(baseline.score)||baseline.score>=66)return [];
  const weak=[...(baseline.comparisons??[])]
    .filter(c=>c.available&&c.score<0.66)
    .sort((a,b)=>a.score-b.score||a.sectionId.localeCompare(b.sectionId))[0];
  if(!weak)return [];
  const source=opening(song,weak.sourceSectionId,weak.windowBars);
  const target=opening(song,weak.sectionId,weak.windowBars);
  if(source.length<4||target.length<4)return [];
  const sourceSection=sectionById(song,weak.sourceSectionId);
  const targetSection=sectionById(song,weak.sectionId);
  const sourceStart=sectionStart(song,sourceSection);
  const targetStart=sectionStart(song,targetSection);
  const register=rolePreferredRegisterWindow("melody")??{min:57,max:79};
  const proposals=[],seen=new Set();

  // Only compare matching relative onsets: preserve a deliberate new pickup
  // or a different syncopated hook rather than forcibly aligning its pitches.
  for(let index=1;index<Math.min(source.length,target.length)-1;index++){
    const entry=target[index],note=entry?.note;
    if(!note||protectedNote(note)||finite(note.duration,0)>=0.65)continue;
    const aligned=Math.abs((finite(source[index].note.start)-sourceStart)
      -(finite(note.start)-targetStart));
    if(!Number.isFinite(aligned)||aligned>0.26)continue;
    for(const candidateRaw of scaleProjectedPitches(source,index,target,classes,register)){
      const pitch=Math.round(candidateRaw);
      if(!allowedPitch(source,target,index,pitch,classes,register))continue;
      if(seen.has(index+":"+pitch))continue;
      seen.add(index+":"+pitch);
      const alternative=cloneValue(song);
      const updated=alternative.tracks.find(t=>t.id==="melody")?.notes?.[entry.index];
      if(!updated)continue;
      updated.pitch=pitch;
      updated.hookReturnV2Role="contour-recall";
      const after=evaluateChorusHookRecurrence(alternative);
      const pair=after.comparisons?.find(c=>c.available&&c.sectionId===weak.sectionId);
      if(!pair||after.status!=="evaluated"
        ||!Number.isFinite(after.score)||after.score<=baseline.score
        ||pair.score-weak.score<0.012)continue;
      proposals.push({
        id:"genre-hook-v2-"+index+"-"+pitch,
        song:alternative,genre,changedNotes:1,
        sourceSectionId:weak.sourceSectionId,targetSectionId:weak.sectionId,
        beforeScore:baseline.score,afterScore:after.score,
        localScoreDelta:round(pair.score-weak.score),
        changedPitch:pitch,originalPitch:note.pitch,
        reason:"bounded-contour-recall",
      });
    }
  }
  return proposals.sort((a,b)=>b.localScoreDelta-a.localScoreDelta
    ||b.afterScore-a.afterScore
    ||Math.abs(a.changedPitch-a.originalPitch)-Math.abs(b.changedPitch-b.originalPitch)
    ||a.id.localeCompare(b.id)).slice(0,limit);
}


/**
 * Developer-only explanation of why a particular weak return cannot produce
 * a one-note V2 candidate. Unlike relaxing protection to chase score, this
 * counts constraints without cloning or changing any musical event.
 */
export function diagnoseGenreHookReturnReadiness(song) {
  const genre=String(song?.meta?.genre??song?.genre??"");
  const report=evaluateChorusHookRecurrence(song);
  const stats={
    genre, hookStatus:report.status, hookScore:report.score, status:"not-applicable",
    sourceNotes:0, returnNotes:0, middleNotes:0, protectedNotes:0,
    shortUnprotectedNotes:0, positionAligned:0, safePitchOptions:0,
    qualityImprovingOptions:0,
  };
  if(!genreSet.has(genre)){stats.status="unsupported-genre";return stats;}
  const classes=keyAuthority(song);
  if(!classes){stats.status="missing-scale-authority";return stats;}
  if(report.status!=="evaluated"||report.score>=66||report.score===null){
    stats.status="not-weak-evaluable";return stats;
  }
  const weak=[...(report.comparisons??[])].filter(c=>c.available&&c.score<0.66)
    .sort((a,b)=>a.score-b.score||a.sectionId.localeCompare(b.sectionId))[0];
  if(!weak){stats.status="no-weak-comparison";return stats;}
  const source=opening(song,weak.sourceSectionId,weak.windowBars);
  const target=opening(song,weak.sectionId,weak.windowBars);
  stats.sourceNotes=source.length;stats.returnNotes=target.length;
  if(source.length<4||target.length<4){stats.status="sparse-hook";return stats;}
  const sourceStart=sectionStart(song,sectionById(song,weak.sourceSectionId));
  const targetStart=sectionStart(song,sectionById(song,weak.sectionId));
  const window=rolePreferredRegisterWindow("melody")??{min:57,max:79};
  const count=Math.min(source.length,target.length);
  stats.middleNotes=Math.max(0,count-2);
  for(let i=1;i<count-1;i++){
    const note=target[i].note;
    if(protectedNote(note)){stats.protectedNotes++;continue;}
    if(finite(note.duration,0)>=0.65)continue;
    stats.shortUnprotectedNotes++;
    const aligned=Math.abs((finite(source[i].note.start)-sourceStart)
      -(finite(note.start)-targetStart));
    if(!Number.isFinite(aligned)||aligned>0.26)continue;
    stats.positionAligned++;
    for(const raw of scaleProjectedPitches(source,i,target,classes,window)){
      if(!allowedPitch(source,target,i,raw,classes,window))continue;
      stats.safePitchOptions++;
      const candidate=cloneValue(song);
      const changed=candidate.tracks.find(t=>t.id==="melody")?.notes?.[target[i].index];
      if(!changed)continue;
      changed.pitch=raw;
      const after=evaluateChorusHookRecurrence(candidate);
      if(after.status==="evaluated"&&after.score>report.score)stats.qualityImprovingOptions++;
    }
  }
  stats.status=stats.middleNotes===stats.protectedNotes?"protected-return"
    :stats.shortUnprotectedNotes===0?"no-short-unprotected-note"
      :stats.positionAligned===0?"no-matched-relative-onsets"
        :stats.safePitchOptions===0?"no-scale-safe-neighbor"
          :stats.qualityImprovingOptions===0?"one-note-change-cannot-improve-hook-score"
            :"candidate-possible";
  return stats;
}
