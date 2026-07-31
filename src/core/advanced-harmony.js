/**
 * Advanced Composition Engine: Harmony & Polyrhythm (Phase 22)
 *
 * Provides pure, unit-testable harmonic extensions and meter math:
 * - Deterministic modal interchange (borrowing minor iv, bVI, bVII in major modes)
 * - Secondary dominant insertion (V7/V, V7/ii) at cadence points
 * - Polyrhythmic & time signature meter math (3/4, 6/8, 5/4, 4/4)
 */

function createRng(seed = 12345) {
  let s = Math.abs(seed | 0) || 1;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function resolveMeterBeats(timeSignature = "4/4") {
  switch (timeSignature) {
    case "3/4":
      return { beatsPerBar: 3, beatUnit: 4, gridUnits: 12 };
    case "6/8":
      return { beatsPerBar: 6, beatUnit: 8, gridUnits: 12 };
    case "5/4":
      return { beatsPerBar: 5, beatUnit: 4, gridUnits: 20 };
    case "4/4":
    default:
      return { beatsPerBar: 4, beatUnit: 4, gridUnits: 16 };
  }
}

export function applyModalInterchange(progression = [], mode = "major", seed = 12345) {
  if (!Array.isArray(progression) || !progression.length) return [];
  const rng = createRng(seed);
  const result = [...progression];

  // Modal interchange substitutions for major keys:
  // Sub 4 -> minor iv (b6), Sub 6 -> bVI, Sub 7 -> bVII
  const modalMap = {
    4: 14, // Minor iv
    6: 16, // bVI
    7: 17, // bVII
  };

  for (let i = 0; i < result.length; i++) {
    const chord = result[i];
    const degree = typeof chord === "number" ? chord : chord.degree;
    if (modalMap[degree] && rng() < 0.35) {
      const substituted = modalMap[degree];
      if (typeof chord === "number") {
        result[i] = substituted;
      } else {
        result[i] = { ...chord, degree: substituted, borrowed: true };
      }
    }
  }

  return result;
}

export function applySecondaryDominants(progression = [], seed = 12345) {
  if (!Array.isArray(progression) || progression.length < 2) return [...progression];
  const rng = createRng(seed);
  const result = [...progression];

  // Target V or ii with a preceding secondary dominant (V7/V or V7/ii)
  for (let i = 0; i < result.length - 1; i++) {
    const nextChord = result[i + 1];
    const nextDegree = typeof nextChord === "number" ? nextChord : nextChord.degree;

    if ((nextDegree === 5 || nextDegree === 2) && rng() < 0.3) {
      const secDomDegree = nextDegree === 5 ? 25 : 22; // V7/V or V7/ii marker
      if (typeof result[i] === "number") {
        result[i] = secDomDegree;
      } else {
        result[i] = { ...result[i], secondaryDominant: true, targetDegree: nextDegree };
      }
    }
  }

  return result;
}
