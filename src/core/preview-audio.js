const SPOTLIGHT_BY_GENRE = Object.freeze({
  ambient: "pad", jazz: "chords", neoSoul: "chords", rnbSoul: "chords", loFiHipHop: "chords",
  house: "bass", techno: "bass", drumBass: "bass", trap: "bass", hipHop: "bass", rap: "bass",
  drill: "bass", reggaeton: "bass", afrobeats: "bass", funk: "bass", rock: "melody", country: "melody",
});

export const PREVIEW_TRANSITION = Object.freeze({
  // Android/WebView output buffers can expose abrupt voice teardown as a click.
  // Keep these fades short enough to preserve timing while spanning multiple
  // hardware buffers on typical 44.1/48 kHz mobile devices.
  startSeconds: 0.012,
  stopSeconds: 0.055,
  sourceTailSeconds: 0.024,
});

const NOTE_ENVELOPE_LIMITS = Object.freeze({
  bass: Object.freeze({ maxDuration: 3.2, maxRelease: 0.55, reverbTail: 0.3 }),
  chords: Object.freeze({ maxDuration: 5.5, maxRelease: 0.9, reverbTail: 0.38 }),
  melody: Object.freeze({ maxDuration: 2.8, maxRelease: 0.55, reverbTail: 0.28 }),
  counterpoint: Object.freeze({ maxDuration: 2.8, maxRelease: 0.62, reverbTail: 0.3 }),
  pad: Object.freeze({ maxDuration: 8, maxRelease: 1.25, reverbTail: 0.42 }),
});
const SPOTLIGHT_TRACKS = Object.freeze(["bass","chords","melody","counterpoint","pad"]);
function clamp01(value){return Math.min(1,Math.max(0,Number(value)||0));}
function finitePositive(value,fallback=0.0001){const numeric=Number(value);return Number.isFinite(numeric)&&numeric>0?numeric:fallback;}

export function previewNoteEnvelope({trackId,duration,release,reverb,articulation}={}){
 const limits=NOTE_ENVELOPE_LIMITS[String(trackId)]??NOTE_ENVELOPE_LIMITS.melody;
 const noteDuration=Math.min(limits.maxDuration,Math.max(0.04,Number(duration)||0.04));
 const tailMultiplier=articulation==="staccato"?0.45:["legato","sustain","glide"].includes(String(articulation))?(trackId==="pad"?1.06:1.1):1;
 const releaseTail=Math.min(limits.maxRelease,Math.max(0.04,((Number(release)||0.04)+clamp01(reverb)*limits.reverbTail)*tailMultiplier));
 return Object.freeze({duration:noteDuration,release:releaseTail});
}
export function normalizeMixAssistant(value={}){
 const spotlightTrack=SPOTLIGHT_TRACKS.includes(String(value.spotlightTrack))?String(value.spotlightTrack):"auto";
 const rawIntensity=Number(value.spotlightIntensity); const intensity=Number.isFinite(rawIntensity)?rawIntensity:68;
 return Object.freeze({enabled:value.enabled!==false,spotlightTrack,spotlightIntensity:Math.round(clamp01(intensity/100)*100)});
}
export function characteristicTrackForPreview(song={},requestedTrack="auto"){
 if(SPOTLIGHT_TRACKS.includes(String(requestedTrack)))return String(requestedTrack);
 const explicit=String(song?.characteristicVoice?.trackId||""); if(SPOTLIGHT_TRACKS.includes(explicit))return explicit;
 const genre=String(song?.meta?.genre??song?.genre??"pop"); return SPOTLIGHT_BY_GENRE[genre]??"melody";
}
export function previewSpotlight(song,trackId,assistant={}){
 const settings=normalizeMixAssistant(assistant),strength=settings.enabled?settings.spotlightIntensity/100:0;
 const active=strength>0&&String(trackId)===characteristicTrackForPreview(song,settings.spotlightTrack);
 return Object.freeze({active,gain:active?1+0.12*strength:1-0.025*strength,cutoff:active?1+0.14*strength:1,reverb:active?1+0.06*strength:1,delay:active?1+0.1*strength:1,priority:active?1:0});
}
export function previewSidechain(song={},assistant={}){
 const settings=normalizeMixAssistant(assistant),strength=settings.enabled?settings.spotlightIntensity/100:0;
 const bpm=Math.min(220,Math.max(48,Number(song?.meta?.tempo??song?.bpm??120)||120));
 return Object.freeze({enabled:strength>0,depth:0.08+0.12*strength,attackSeconds:0.006,holdSeconds:Math.min(0.04,(60/bpm)*0.06),releaseSeconds:Math.min(0.18,Math.max(0.09,(60/bpm)*0.24))});
}
export function previewMixHealth(song={},trackSettings={},assistant={}){
 const settings=normalizeMixAssistant(assistant);
 const volumes=Object.values(trackSettings).map(track=>Number(track?.volume)).filter(Number.isFinite).map(clamp01);
 const average=volumes.length?volumes.reduce((sum,value)=>sum+value,0)/volumes.length:0.72;
 const load=clamp01(average*0.78+Math.min(volumes.length,6)*0.025),spotlight=characteristicTrackForPreview(song,settings.spotlightTrack);
 const status=load>0.88?"Hot":load<0.48?"Open":"Balanced";
 return Object.freeze({load:Math.round(load*100),headroom:Math.max(0,Math.round((1-load)*12)),status,spotlight});
}
export function holdAudioParamValue(parameter,now,fallbackValue=0.0001){
 const time=Math.max(0,Number(now)||0),currentValue=finitePositive(parameter?.value,finitePositive(fallbackValue));
 if(!parameter)return currentValue;
 try{if(typeof parameter.cancelAndHoldAtTime==="function")parameter.cancelAndHoldAtTime(time);else{if(typeof parameter.cancelScheduledValues==="function")parameter.cancelScheduledValues(time);if(typeof parameter.setValueAtTime==="function")parameter.setValueAtTime(currentValue,time);else parameter.value=currentValue;}}
 catch{try{parameter.value=currentValue;}catch{}}
 return currentValue;
}
export function rampAudioParamValue(parameter,targetValue,now,duration=PREVIEW_TRANSITION.stopSeconds,{minimum=0.0001}={}){
 const time=Math.max(0,Number(now)||0),seconds=Math.max(0,Number(duration)||0),floor=finitePositive(minimum);
 const startValue=holdAudioParamValue(parameter,time,floor),target=Math.max(floor,finitePositive(targetValue,floor)),endTime=time+seconds;
 if(!parameter)return Object.freeze({startValue,targetValue:target,endTime});
 try{if(seconds<=1e-6){if(typeof parameter.setValueAtTime==="function")parameter.setValueAtTime(target,time);else parameter.value=target;}
 else if(startValue>0&&target>0&&typeof parameter.exponentialRampToValueAtTime==="function")parameter.exponentialRampToValueAtTime(target,endTime);
 else if(typeof parameter.linearRampToValueAtTime==="function")parameter.linearRampToValueAtTime(target,endTime);
 else if(typeof parameter.setTargetAtTime==="function")parameter.setTargetAtTime(target,time,Math.max(0.001,seconds/3));else parameter.value=target;}
 catch{try{parameter.value=target;}catch{}}
 return Object.freeze({startValue,targetValue:target,endTime});
}
export function clickSafeStopTime(now,startedAt,transition=PREVIEW_TRANSITION){
 const current=Math.max(0,Number(now)||0),start=Math.max(0,Number(startedAt)||0);
 if(start>current+transition.stopSeconds)return current;
 return current+transition.stopSeconds+transition.sourceTailSeconds;
}
