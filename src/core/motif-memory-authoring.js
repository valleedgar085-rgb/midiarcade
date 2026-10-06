function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function validMotif(motif) {
  return Boolean(
    motif
    && Number.isFinite(Number(motif.lengthBeats))
    && Array.isArray(motif.events)
    && motif.events.length >= 3
  );
}

function familyMelody(family, motifId) {
  return family?.[motifId]?.melody ?? null;
}

function memorySections(phraseMemory) {
  return Array.isArray(phraseMemory)
    ? phraseMemory
    : Array.isArray(phraseMemory?.sections)
      ? phraseMemory.sections
      : [];
}

function deterministicSign(seed, label) {
  return hashSeed(`${seed}::${label}`) % 2 === 0 ? -1 : 1;
}

function interiorPositions(eventCount, seed, label, desired = 2) {
  if (eventCount <= 2) return [];
  const candidates = [];
  for (let index = 1; index < eventCount - 1; index += 1) candidates.push(index);
  candidates.sort((left, right) => (
    hashSeed(`${seed}::${label}::${left}`)
      - hashSeed(`${seed}::${label}::${right}`)
    || left - right
  ));
  return candidates.slice(0, Math.min(desired, candidates.length)).sort((a, b) => a - b);
}

function shiftDegree(event, amount) {
  event.degree = Math.round(clamp(finite(event.degree) + amount, -9, 9));
}

function developReturn(source, memory, seed) {
  const motif = clone(source);
  const strength = clamp(memory?.recallStrength ?? 0.8, 0, 1);
  // Strong returns should sound developed, not rewritten. Preserve more of the
  // authored contour as recall strength rises so a chorus return remains
  // recognizable before any post-generation repair is considered.
  const changeCount = strength >= 0.86
    ? 1
    : motif.events.length >= 6 ? 2 : 1;
  const positions = interiorPositions(motif.events.length, seed, `return:${memory.sectionId}`, changeCount);
  for (const [ordinal, index] of positions.entries()) {
    const direction = deterministicSign(seed, `return-degree:${memory.sectionId}:${index}`);
    const magnitude = strength >= 0.82 ? 1 : (ordinal > 0 ? 1 : 2);
    shiftDegree(motif.events[index], direction * magnitude);
  }

  if (motif.events.length >= 4) {
    const index = Math.max(1, motif.events.length - 2);
    motif.events[index].duration = round(clamp(
      finite(motif.events[index].duration, 0.5) * (strength >= 0.78 ? 0.92 : 0.84),
      0.16,
      3.5,
    ));
  }

  // Preserve the source hook's opening and landing, but make a return breathe
  // before its final answer instead of filling every available subdivision.
  if (motif.events.length >= 5 && finite(motif.lengthBeats, 0) >= 2) {
    const landing = motif.events[motif.events.length - 1];
    const previous = motif.events[motif.events.length - 2];
    const available = finite(landing.offset) - finite(previous.offset);
    if (available >= 0.5) {
      previous.duration = round(clamp(
        Math.min(finite(previous.duration, 0.5), Math.max(0.16, available - 0.25)),
        0.16,
        3.5,
      ));
      previous.phraseBreathAfter = true;
    }
  }

  motif.phraseShape = motif.phraseShape ?? "return";
  return motif;
}

function developRecall(source, memory, seed) {
  const motif = clone(source);
  const transform = String(memory?.transform ?? "");
  const strength = clamp(memory?.recallStrength ?? 0.7, 0, 1);
  const positions = interiorPositions(
    motif.events.length,
    seed,
    `recall:${memory.sectionId}`,
    motif.events.length >= 7 ? 3 : 2,
  ).filter((index) => (
    transform !== "ending-answer"
    || index < motif.events.length - 3
  ));

  for (const [ordinal, index] of positions.entries()) {
    const event = motif.events[index];
    const direction = deterministicSign(seed, `recall-degree:${memory.sectionId}:${index}`);
    if (transform === "rhythmic-echo" && ordinal === 0) {
      const previous = motif.events[index - 1];
      const next = motif.events[index + 1];
      const minimum = finite(previous?.offset) + 0.125;
      const maximum = Math.max(minimum, finite(next?.offset, motif.lengthBeats) - 0.125);
      const shift = direction * 0.25;
      event.offset = round(clamp(finite(event.offset) + shift, minimum, maximum));
      event.duration = round(clamp(finite(event.duration, 0.5) * 0.86, 0.16, 3.5));
    } else {
      const magnitude = strength >= 0.8 && ordinal > 0 ? 1 : 2;
      shiftDegree(event, direction * magnitude);
    }
  }

  if (transform === "ending-answer" && motif.events.length >= 3) {
    const penultimate = motif.events[motif.events.length - 2];
    // Keep the authored three-note cadence contour recognizable. The "answer"
    // is expressed as articulation development instead of replacing the pitch
    // evidence that identifies the source phrase.
    const direction = deterministicSign(seed, `ending-answer:${memory.sectionId}`);
    penultimate.duration = round(clamp(
      finite(penultimate.duration, 0.5) * (direction > 0 ? 0.82 : 1.14),
      0.16,
      3.5,
    ));
  }

  motif.events.sort((left, right) => finite(left.offset) - finite(right.offset));
  motif.phraseShape = motif.phraseShape ?? "recall";
  return motif;
}

function developContrast(source, fallback, memory, seed) {
  if (!validMotif(fallback)) return clone(source);
  const motif = clone(fallback);
  if (!validMotif(source)) return motif;

  // Preserve a small but measurable family fingerprint while keeping the
  // contrasting motif in charge. The opening identifies the family; the
  // landing and final direction preserve cadence memory. Interior pitches and
  // rhythm remain the contrasting motif, so this cannot collapse into a clone.
  motif.events[0].degree = Math.round(finite(source.events[0]?.degree, motif.events[0].degree));
  if (motif.events.length >= 3 && source.events.length >= 3) {
    const sourceTail = source.events.slice(-2);
    const sourceLanding = Math.round(finite(
      sourceTail[1]?.degree,
      motif.events[motif.events.length - 1].degree,
    ));
    const sourceInterval = Math.round(
      finite(sourceTail[1]?.degree) - finite(sourceTail[0]?.degree),
    );
    const sourceDirection = Math.sign(sourceInterval)
      || deterministicSign(seed, `contrast-tail:${memory.sectionId}`);
    const intervalMagnitude = Math.max(1, Math.min(2, Math.abs(sourceInterval) || 1));
    const targetIndex = motif.events.length - 2;
    const final = motif.events[motif.events.length - 1];

    final.degree = Math.round(clamp(sourceLanding, -9, 9));
    motif.events[targetIndex].degree = Math.round(clamp(
      finite(final.degree) - sourceDirection * intervalMagnitude,
      -9,
      9,
    ));
  }
  return motif;
}

function authorVariant({ source, fallback, memory, seed }) {
  const relationship = String(memory?.relationship ?? "");
  if (!validMotif(source)) return null;
  if (relationship === "return") return developReturn(source, memory, seed);
  if (relationship === "recall") return developRecall(source, memory, seed);
  if (relationship === "contrast") return developContrast(source, fallback, memory, seed);
  return null;
}

function variantSignature(motif) {
  return JSON.stringify((motif?.events ?? []).map((event) => [
    round(event.offset),
    round(event.duration),
    Math.round(finite(event.degree)),
  ]));
}

export function authorMotifMemoryVariants({
  family = {},
  assignments = [],
  phraseMemory = null,
  seed = "",
} = {}) {
  const assignmentBySection = new Map(
    (assignments ?? []).map((assignment) => [String(assignment.sectionId), assignment]),
  );
  const memories = memorySections(phraseMemory);
  const sectionMotifs = {};
  const report = [];

  for (const memory of memories) {
    const relationship = String(memory?.relationship ?? "");
    if (!["recall", "return", "contrast"].includes(relationship)) continue;
    const sectionId = String(memory?.sectionId ?? "");
    const sourceSectionId = String(memory?.sourceSectionId ?? memory?.originSectionId ?? "");
    if (!sectionId || !sourceSectionId || sectionId === sourceSectionId) continue;

    const sourceAssignment = assignmentBySection.get(sourceSectionId);
    const targetAssignment = assignmentBySection.get(sectionId);
    const source = familyMelody(family, sourceAssignment?.motifId);
    const fallback = familyMelody(family, targetAssignment?.motifId);
    const motif = authorVariant({
      source,
      fallback,
      memory,
      seed: `${seed}::${sourceSectionId}::${sectionId}`,
    });
    if (!validMotif(motif)) continue;

    const sourceSignature = variantSignature(source);
    const variant = {
      ...motif,
      memoryAuthoring: {
        version: 1,
        sectionId,
        sourceSectionId,
        relationship,
        transform: memory?.transform ?? null,
        recallStrength: round(clamp(memory?.recallStrength ?? 0.7, 0, 1)),
        sourceMotifId: sourceAssignment?.motifId ?? null,
        fallbackMotifId: targetAssignment?.motifId ?? null,
        changedFromSource: variantSignature(motif) !== sourceSignature,
      },
    };
    sectionMotifs[sectionId] = { melody: variant };

    report.push({
      sectionId,
      sourceSectionId,
      relationship,
      transform: memory?.transform ?? null,
      sourceMotifId: sourceAssignment?.motifId ?? null,
      fallbackMotifId: targetAssignment?.motifId ?? null,
      eventCount: variant.events.length,
      changedFromSource: variant.memoryAuthoring.changedFromSource,
    });
  }

  return Object.freeze({
    version: 1,
    authority: "motif-memory-authoring-v1",
    sectionMotifs: Object.freeze(sectionMotifs),
    sections: Object.freeze(report),
  });
}

export const MOTIF_MEMORY_AUTHORING_VERSION = "1.0";
