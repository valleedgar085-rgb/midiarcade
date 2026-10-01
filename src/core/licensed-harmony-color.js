function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function mod12(value) {
  return ((Math.round(finite(value)) % 12) + 12) % 12;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicRoll(seed, label) {
  return hashSeed(`${seed}::${label}`) / 4294967296;
}

function scaleClasses(config = {}) {
  const tonic = mod12(config.keyPc);
  const intervals = Array.isArray(config.scaleIntervals) ? config.scaleIntervals : [];
  return new Set(intervals.map((interval) => mod12(tonic + interval)));
}

function pitchName(pitchClass, preferFlats = false) {
  const sharps = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flats = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  return (preferFlats ? flats : sharps)[mod12(pitchClass)];
}

export const HARMONIC_COLOR_POLICY = Object.freeze({
  jazz: Object.freeze({ borrowed: 0.08, secondaryDominant: 0.18, chromaticApproach: 0.14 }),
  neoSoul: Object.freeze({ borrowed: 0.15, secondaryDominant: 0.12, chromaticApproach: 0.11 }),
  rnbSoul: Object.freeze({ borrowed: 0.15, secondaryDominant: 0.12, chromaticApproach: 0.11 }),
  loFiHipHop: Object.freeze({ borrowed: 0.08, secondaryDominant: 0.06, chromaticApproach: 0.08 }),
  pop: Object.freeze({ borrowed: 0.06, secondaryDominant: 0.06, chromaticApproach: 0.05 }),
  rock: Object.freeze({ borrowed: 0.10, secondaryDominant: 0.04, chromaticApproach: 0.03 }),
  hipHop: Object.freeze({ borrowed: 0.04, secondaryDominant: 0.04, chromaticApproach: 0.05 }),
  rap: Object.freeze({ borrowed: 0.04, secondaryDominant: 0.04, chromaticApproach: 0.04 }),
});

function policyFor(config = {}) {
  return HARMONIC_COLOR_POLICY[String(config.genre ?? "")] ?? null;
}

function colorIntensity(config = {}) {
  return clamp(
    0.48
      + clamp(config.complexity, 0, 1) * 0.28
      + clamp(config.surprise, 0, 1) * 0.16,
    0.4,
    0.92,
  );
}

function colorBudget(config = {}) {
  return Math.max(1, Math.min(3, Math.floor(Math.max(4, finite(config.bars, 4)) / 12) || 1));
}

function outsideClasses(tones, config) {
  const allowed = scaleClasses(config);
  return [...new Set((tones ?? []).map(mod12).filter((pitchClass) => !allowed.has(pitchClass)))];
}

function borrowedMinorFourth(event, config) {
  const rootPc = mod12(event.rootPc ?? event.tones?.[0]);
  const tones = [rootPc, mod12(rootPc + 3), mod12(rootPc + 7)];
  return Object.freeze({
    ...event,
    rootPc,
    tones,
    quality: "minor",
    extension: null,
    symbol: `${event.root ?? pitchName(rootPc, String(config.key ?? "").includes("b"))}m`,
    roman: "iv",
    borrowed: true,
    modalInterchange: true,
    harmonicLicense: "modalInterchange",
    licensedPitchClasses: Object.freeze(outsideClasses(tones, config)),
  });
}

function secondaryDominant(event, target, config) {
  const targetRootPc = mod12(target?.rootPc ?? target?.tones?.[0]);
  const rootPc = mod12(targetRootPc + 7);
  const tones = [rootPc, mod12(rootPc + 4), mod12(rootPc + 7), mod12(rootPc + 10)];
  const root = pitchName(rootPc, String(config.key ?? "").includes("b"));
  return Object.freeze({
    ...event,
    rootPc,
    root,
    tones,
    quality: "major",
    extension: "7",
    symbol: `${root}7`,
    roman: `V7/${target?.roman ?? target?.root ?? "target"}`,
    secondaryDominant: true,
    targetRootPc,
    harmonicLicense: "secondaryDominant",
    licensedPitchClasses: Object.freeze(outsideClasses(tones, config)),
  });
}

export function applyLicensedHarmonyColor(harmony = [], config = {}) {
  if (
    !config?.professionalUpgrade
    || finite(config?.complexity, 0) < 0.48
    || !Array.isArray(harmony)
    || harmony.length < 2
  ) {
    return harmony;
  }

  const policy = policyFor(config);
  if (!policy) return harmony;

  const result = harmony.map((event) => ({ ...event, tones: [...(event?.tones ?? [])] }));
  const usedSections = new Set();
  let remaining = colorBudget(config);
  const intensity = colorIntensity(config);
  const canBorrow = ["major", "mixolydian"].includes(String(config.scale ?? ""));

  for (let index = 0; index < result.length - 1 && remaining > 0; index += 1) {
    const event = result[index];
    const next = result[index + 1];
    if (event?.harmonicLicense) continue;
    const sectionKey = String(event?.sectionId ?? `bar:${event?.bar ?? index}`);
    if (usedSections.has(sectionKey)) continue;

    const secondaryChance = clamp(policy.secondaryDominant * intensity, 0, 0.22);
    const secondaryRoll = deterministicRoll(config.seed, `secondary-dominant:${index}`);
    if (
      secondaryChance > 0
      && secondaryRoll < secondaryChance
      && Number.isFinite(Number(next?.rootPc ?? next?.tones?.[0]))
      && mod12(event?.rootPc ?? event?.tones?.[0]) !== mod12(next?.rootPc ?? next?.tones?.[0])
    ) {
      const colored = secondaryDominant(event, next, config);
      if (colored.licensedPitchClasses.length) {
        result[index] = colored;
        usedSections.add(sectionKey);
        remaining -= 1;
        continue;
      }
    }

    const borrowedChance = clamp(policy.borrowed * intensity, 0, 0.18);
    const borrowedRoll = deterministicRoll(config.seed, `borrowed-iv:${index}`);
    if (
      canBorrow
      && mod12(event?.degree ?? -1) === 3
      && borrowedChance > 0
      && borrowedRoll < borrowedChance
    ) {
      const colored = borrowedMinorFourth(event, config);
      if (colored.licensedPitchClasses.length) {
        result[index] = colored;
        usedSections.add(sectionKey);
        remaining -= 1;
      }
    }
  }

  return result;
}

export function tonalLicenseForChordPitch(pitch, chord, config = {}) {
  if (!chord?.harmonicLicense) return null;
  const pitchClass = mod12(pitch);
  const chordClasses = new Set((chord?.tones ?? []).map(mod12));
  if (!chordClasses.has(pitchClass) || scaleClasses(config).has(pitchClass)) return null;

  const tonalLicense = {
    modalInterchange: "borrowedChordTone",
    secondaryDominant: "secondaryDominantTone",
    alteredDominant: "alteredDominantTone",
  }[chord.harmonicLicense] ?? null;
  if (!tonalLicense) return null;

  return Object.freeze({
    tonalLicense,
    harmonicColorSource: chord.harmonicLicense,
    harmonicColorChord: chord.symbol ?? chord.roman ?? null,
  });
}

export function applyIntentionalChromaticApproaches(notes = [], config = {}, trackId = "melody") {
  const policy = policyFor(config);
  if (
    trackId !== "melody"
    || !config?.professionalUpgrade
    || finite(config?.bars, 0) < 4
    || finite(config?.complexity, 0) < 0.5
    || !policy?.chromaticApproach
    || !Array.isArray(notes)
    || notes.length < 2
  ) {
    return notes;
  }

  const allowed = scaleClasses(config);
  const result = notes.map((note) => ({ ...note }));
  const ordered = [...result].sort((left, right) => (
    finite(left?.start) - finite(right?.start)
    || finite(left?.pitch) - finite(right?.pitch)
  ));
  let remaining = colorBudget(config);
  const probability = clamp(policy.chromaticApproach * colorIntensity(config), 0, 0.16);

  for (let index = 0; index < ordered.length - 1 && remaining > 0; index += 1) {
    const note = ordered[index];
    const next = ordered[index + 1];
    if (note?.phraseAnchor || note?.tonalLicense) continue;

    const start = finite(note?.start);
    const nextStart = finite(next?.start, Infinity);
    const gap = nextStart - start;
    if (gap <= 0.08 || gap > 1 || finite(note?.duration, 0.25) > 0.45) continue;
    if (Math.abs(start - Math.round(start)) <= 0.055) continue;

    const nextPitch = Math.round(finite(next?.pitch, 60));
    const originalPitch = Math.round(finite(note?.pitch, 60));
    if (!allowed.has(mod12(nextPitch)) || !allowed.has(mod12(originalPitch))) continue;

    const options = [nextPitch - 1, nextPitch + 1]
      .filter((pitch) => pitch >= 0 && pitch <= 127)
      .filter((pitch) => !allowed.has(mod12(pitch)))
      .filter((pitch) => Math.abs(pitch - originalPitch) <= 3)
      .sort((left, right) => (
        Math.abs(left - originalPitch) - Math.abs(right - originalPitch)
        || left - right
      ));
    if (!options.length) continue;

    const roll = deterministicRoll(config.seed, `chromatic-approach:${trackId}:${index}:${start}`);
    if (roll >= probability) continue;

    note.pitch = options[0];
    note.duration = Math.min(
      finite(note?.duration, 0.25),
      0.3,
      Math.max(0.08, gap - 0.03),
    );
    note.tonalLicense = "chromaticApproach";
    note.melodicColorIntent = "approach-by-semitone";
    note.resolvesToPitch = nextPitch;
    remaining -= 1;
  }

  return result;
}

export const LICENSED_HARMONY_COLOR_VERSION = "1.0";
