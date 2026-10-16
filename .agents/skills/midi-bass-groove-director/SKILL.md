---
name: midi-bass-groove-director
description: Make MIDI Arcade bass and 808 patterns deep, kick-locked, jumpy, groovy and danceable while preserving existing sound, harmonic safety, genre timing and MIDI export parity.
---

# MIDI Arcade — Bass Head Groove Director

**Use for:** heavy bass, 808s, jumpy bass, funky basslines, kick/bass timing, syncopation, low-end movement, bass slides, weak bass, muddy bass, dropped bass notes, and dance/club grooves.

**Musical mission:** Make low end **physically engaging**, rhythmically precise, and satisfying. Strong bass is not merely high velocity or the greatest number of notes. It is an intentional relationship among the kick, bass attack, space, pitch, note lengths, recurring motifs, harmony and mix.

**Scope:** Developer-only composition and review skill. This document does NOT add an Android feature, second generation authority, new audio patch, boost, compressor, model, or dependency. Read root AGENTS.md first, then use midi-composition-review and midi-safe-integration. For any synthesis, audio quality, clicks/pops, loudness or frequency intervention, also use midi-audio-diagnostics.

## What Bass Head means for this project

1. **Deep weight:** The low root or fifth should feel confident. Preserve lower-frequency impact and pitch/harmony intelligibility. Deep notes that disappear on a phone need appropriately validated upper-harmonic translation, *not* automatic octave shifting or a master-volume hike.
2. **Perfect pocket:** Kick and bass intentionally lock at important pulses and separate where space enhances the bounce. Timing may be straight, swung, ahead or behind *by musical design*—not random jitter. "Perfect" does not mean every event must share the same grid onset.
3. **Jumpy dance feel:** Syncopated answers, short-long note shapes, an occasional octave leap, and anticipatory pickups that make the body want to move. Preserve rests that make the next bass hit powerful.
4. **Recognizable bass riff:** A memorable 1–2 bar cell should anchor a song. Develop the cell with one purposeful change toward a chorus/drop, rather than unpredictably replacing every bass phrase.
5. **A section arc:** Verses can feel relaxed and open for vocals. Stronger choruses gain weight from a clear entrance, phrased note-length changes or selective fill—not from permanently excessive density.
6. **Clear harmony:** Respect key, mode, chord path, phrase cadence and protected notes. Do not let bass smear between chords, overpower the kick, or collide with chord voicing.

## Required order of work

**A. Freeze the baseline.** Record current main SHA, APK version, saved seed, genre/secondary genre, BPM, time signature, bars, key/mode/harmonic path, variation/evolution/swing/humanize, kick pattern and original bass MIDI. Choose at least one bass-forward and one restrained comparison genre. Preserve current approved Web Audio sound.

**B. Diagnose before changing.** Distinguish: bass absent from a section; pitches too low to translate; attack masked by kick; bad note lengths; unintentional timing offset; late groove refinement changing the kick relationship; scale/chord fit error; or audio-envelope playback fault. These do not share the same fix.

**C. Declare the kick/bass relationship.** For each important beat choose reinforcement, answer, anticipation, or silence. Determine which instrument is the timing reference. On a two-bar sheet, mark downbeats and offbeats, the backbeat and the intended bass-note ends.

**D. Compose with space.** Place the root/fifth or other harmony anchor; make an intentional offbeat answer; control note length to avoid masking; use passing scale tones or short octave motion only when the phrase needs them; preserve chord changes and deliberate rests. Repeat a recognizable pattern with selective variation.

**E. Inspect in context.** Listen to drums plus bass alone, then the full mix, then phone speaker and headphones where possible. Compare fixed seeds and identical instrument sounds. An exciting bass-only mix that buries the vocal or bass drum is not a success.

## Pocket archetypes (choose per genre, not universal rules)

| Pocket | Approach | Pitfall |
| --- | --- | --- |
| Kick-locked impact | Bass hits reinforce selected kick onsets; strong pulse stays identifiable | Kick and sub tails collide constantly |
| Bouncy call/response | Kick states the beat; bass answers on an eighth/sixteenth offbeat or rests | Unanchored/random notes |
| Hybrid | Shared first downbeat, then rhythmic bass replies/pickup | Too many competing accents |
| Trap/Drill 808 | Tonal 808 holds select kick accents; short anticipatory hit or intentional slide into payoff | Uncontrolled low-frequency tail or off-key slides |
| Dance/House/Techno | Consistent kick; bass offbeats and purposeful short releases between kick attacks | Bass covers each kick transient |
| Funk/Neo-soul | Syncopated rhythmic motif, octave/scale-tone motion, intentional push/pull and silence | Overplaying destroys feel |
| Rap/Hip-hop | Steady low-end hook plus breathing room for vocal delivery | Fills compete with rapper's flow |
| Afrobeats/Reggaeton | Cyclic, interlocking relationship with percussion groove | Treating every groove as trap 808 |

Illustrative bar in 4/4: kicks at beats 0, 1, 2, 3; *one possible* four-on-floor bass response at 0.5, 1.5, 2.5, 3.5, with gaps before kick transients. Another hip-hop/funk starting sketch: kick+bass at 0, bass response at 1.5, quick pickup at 3.75. These examples are compositional starting points, not a rule to force on generated music.

## Musical timing: verify, do not guess

- Work with actual bass-onset and kick-onset MIDI events. Kick notes must be isolated by appropriate drum MIDI mapping, not by assuming the entire drums track is one kick.
- When comparing deliberately related attacks, calculate signed difference: deltaBeats = bassStartBeat - pairedKickStartBeat. Convert to milliseconds: deltaMs = 60000 * deltaBeats / BPM.
- Review *both* mean/median relationship and variation across repetition. A repeatable behind-the-beat pocket may be musical; an erratic one is suspect.
- Compare note OFF events, especially consecutive sub notes at chord changes and across a kick. Note length/release can matter more than note quantity.
- Never force one zero-offset timing threshold for every genre; preserve existing genre-specific microtiming contracts.

## Current code authorities: REUSE, do not rebuild

- Groove and kick/bass interaction: src/core/groove-intelligence.js; src/core/groove-contract.js; src/core/groove-authority-lock.js.
- Surgical timing and pocket refinement: src/core/groove-pocket-refinement.js.
- Bass continuity and bounded candidate repair: src/core/bass-continuity-refinement.js and src/core/output-quality-pipeline-register.js.
- Ensemble relationships and critical evaluation: src/core/ensemble-coordination-authority.js, src/core/cross-authority-coherence.js, src/core/composition-candidate-judge.js.
- One authoritative seeded music composer: src/music-engine.js.
- Synth or audible bass tone only with midi-audio-diagnostics: src/core/preview-audio.js, src/core/preview-performance.js and src/app.js.

## Measurements before proposing any bass-engine change

Record per section or 1–4 bars:
- Anchor hits paired with kicks versus complementary offbeats and pickups.
- Signed onset deltas, note durations, overlap/gaps and repeated motif consistency.
- Low-register note counts and chord-bass separation, key/scale/chord-tone fit and section-to-section bass presence.
- Vocal negative space, perceived kick attack, clarity of bass transitions and whether the rhythm makes you nod/dance.
- Distinguish symbolic MIDI metrics from actual audio: velocity/low note count cannot prove loudness, sub-bass weight, clipping or phone-speaker translation.

**Do not equate more bass notes or bigger velocity with better bass.** Report sample size, seed/config, unchanged tracks and the limitations of any scoring metric. Explicitly note when audio listening is pending.

## Safe implementation and testing

1. Prefer a **read-only groove map or benchmark** first, then reproduce the exact weak pocket. Find the earliest existing authority that owns it.
2. When changing notes, use an opt-in experiment or the existing bounded candidate/refinement path with deterministic seed. Keep three-candidate arrangement selection, existing critic/release gate, note topology/protected roles and MIDI export parity.
3. Preserve all other tracks and preview playback unless the specific correction explicitly requires a co-owned timing change. Never alter a synthesizer, 808 tuning, limiter, gain staging, ADSR, master bus or lowpass indiscriminately; if audio changes are justified, use midi-audio-diagnostics and test the approved sound baseline.
4. Use test-first RED → GREEN where possible. Example focused commands: node --test tests/groove-pocket-refinement.test.mjs tests/bass-continuity-refinement.test.mjs tests/cross-authority-coherence.test.mjs tests/midi-export-parity.test.mjs.
5. Full quality: npm run quality and npm run quality:music. For Android audio, run matching preview/audio tests and confirm on a real phone before claiming audible improvement.
6. Where actual autonomous agents are available, split independent bass groove analysis, low-end audio analysis, and regression review with isolated file scope; otherwise do independent parallel source inspection without pretending separate agents ran.

## Required report for every bass-focused phase

**Baseline/seed | desired low-end feel | BPM/genre | kick+bass archetype | onset/duration evidence | bass motif/notes/rests | identified owning stage | changed vs untouched tracks | regression and full CI status | MIDI export parity | A/B listening conclusion or missing evidence | skills and actual agents used.**

## External references (research only, NOT runtime imports)

- mc-rhythm-section — groove roles, per-lane quantization and intentional kick/bass relations: https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-rhythm-section/SKILL.md
- mc-style-hiphop — 808 roles, hip-hop pocket, half-time and vocal space: https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-style-hiphop/SKILL.md
- mc-rhythm-groove — syncopation/bounce: https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-rhythm-groove/SKILL.md

**Success:** Heavy, clean, rhythmic bass that makes the user want to move, while preserving the approved sound, music theory, determinism and preview-to-MIDI parity.
