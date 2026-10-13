# Opt-in Jazz ride/bell structural answer

After #325 (`20445f1`), the exact-onset drum critic reports 75 on the three quality-lab Jazz seeds. Microtiming makes all bar signatures unique even when ride cells recur. This change does not alter that critic, thresholds, or the rolled-back Jazz memory configuration.

`jazzStructuralVariationRefinement: true` enables a deterministic ensemble-owned candidate in the output quality pipeline. Default generation does not run it. At most three candidates are evaluated, and one can change exactly two existing ride-bow hits (GM 51) into ride-bell hits (GM 53), in the second half of one interior bar. The bell must already occur in the song. Two prior statements of the same two-beat cell are required. No note is added, deleted, moved, lengthened, or given a new velocity. Kick/snare events and all pitched tracks are identical. Fill, transition, anchor, memory and finalized-performance material is protected.

The observation-only audit groups ride voices on a 12-subdivision beat grid within 0.035 beat; it never quantizes output. It distinguishes voice patterns, not only onset rhythms. This is a small orchestration answer, not a new rhythmic pattern or a claim of solved Jazz groove quality. Admission requires one additional distinct cell and one fewer repeated cell, plus non-regressing existing critic dimensions, score, coherence, scale safety and release gates. No Jazz memory credit tags are added.

Fixed 16-bar seeds `quality-lab-01:jazz`, `quality-lab-02:jazz`, and `quality-lab-03:jazz` each accept two edits: distinct cells 6->7, 8->9, and 10->11 respectively. Drum variety stays 75->75. These are structural measurements, not listening-test results.

The required preview correction maps GM 53 to cymbal instead of the previous accidental snare fallback, with a shorter, brighter bell character. This affects preview of existing GM 53 events too, but changes no generated notes or exported MIDI by default. The synthesized preview is not an acoustic ride-bell recording.

Validation: focused fixture and real-seed tests cover deterministic generation, literal opt-in, default rollback preservation, exact edit scope, protected notes, rejection without source mutation, critic/release floors, MIDI round-trip parity and preview bell classification. Full CI and music matrices remain required before merge.
