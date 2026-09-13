# MIDI Arcade

MIDI Arcade is a local-first Android piano improvisation studio and deterministic multitrack MIDI song generator. It turns a musical direction into a structured backing band, gives the player live harmony guidance, captures a piano performance, and exports the band plus the take as an editable Standard MIDI File.

The project started as a song-generation and MIDI workflow experiment and has evolved into a much stricter producer-oriented system: deterministic composition, critic-guided candidate search, surgical repair, Android-safe preview playback, DAW-ready MIDI export, measurable quality gates, and a modular application architecture built to support continued iteration without destabilizing the music engine.

## Flagship loop

1. **Create** — generate a genre-aware arrangement with drums, bass, chords, melody, counterline, and atmosphere.
2. **Jam** — play the multitouch piano, a computer keyboard, Web MIDI, or native Android MIDI/USB input.
3. **Improve** — follow the active and upcoming chord, highlight chord/scale tones, and receive private on-device feedback for pitch fit, chord tones, pocket, and phrasing.
4. **Finish elsewhere** — edit notes in the built-in piano roll, then export one Type-1 `.mid` with six named band tracks and an optional seventh Live Piano Take.

Jam Studio supports sustain-pedal input, hot-plug refresh, stuck-note cleanup, backing-only playback, partial take quantization, practice streaks, and a separate personal-best score. It does not reward playing more notes; simple, well-placed phrases can score as highly as busy ones.

## Composition and editing

The deterministic engine now covers a broad production palette including Techno, Trap, R&B / Soul, Ambient, Drum & Bass, Hip-Hop, Jazz, Neo Soul, Pop, Pop Radio, Rap, Reggaeton, Rock, Country, Drill, Lo-Fi Hip-Hop, Synth Pop / Radio, Funk, Synthwave, Afrobeats, and House. Each profile supplies its own tempo pocket, modes, groove grammar, chord movement, phrase behavior, arrangement shape, human feel, and General MIDI palette.

- **New song idea** creates a new seed, form, harmony, motif, groove, sound palette, and every instrument part.
- **More like this** preserves the idea's musical DNA while composing a related variation.
- **Power, Motion, Bloom, and Hush** rewrite only the selected instrument.
- **Piano roll** tools draw, select, quantize, humanize, nudge, resize, transpose, duplicate, and delete notes with one-step Undo.
- **Human feel** controls expose triplet spice, transition rolls, phrase evolution, surprise, swing, and timing variation.
- **Autosave** restores the latest valid song, live take, settings, score, and practice progress from on-device storage.

Generation is deterministic and multi-candidate. The Producer Brain can expand a bounded search only when the normal pool misses its musical target, diagnose the weakest dependency group, steer additional auditions toward that weakness, and test at most two targeted repairs. Repairs are never accepted merely because they are different: they must improve the diagnosed weakness while preserving scale safety, release quality, critical musical dimensions, and overall balance.

The browser preview uses layered filtered voices, stereo placement, convolution ambience, a tempo-safe delay bus, low-end cleanup, saturation, compression, and generated CC11 expression curves. Android uses a deliberately cheaper preview graph and tighter voice budget to reduce gaps and dropouts on constrained devices. Exported sound still depends on the receiving DAW or MIDI instrument.

## Why the project evolved this way

The central engineering problem was never just “generate more notes.” It was to make generated songs feel more deliberate while preserving determinism, Android reliability, MIDI safety, and the ability to improve one weak musical idea without destroying everything around it.

That led to several recurring rules:

- **Determinism first.** The same seed and configuration must reproduce the same result; generation code does not use unseeded `Math.random()`.
- **Measure before tuning.** Music Quality Lab, release-gauntlet tests, repair-effectiveness calibration, and fixed real-seed regressions are used before keeping a new strategy.
- **Prefer surgical edits.** A two-bar problem should not require rewriting an entire song unless the whole-song alternative is measurably better.
- **Reject collateral damage.** A repair can improve its target and still be rejected if it damages harmony, groove, genre authenticity, separation, creative floor, release readiness, or clean melody/counterpoint dialogue.
- **Keep CPU bounded.** Candidate search stays under a hard 12-candidate ceiling and targeted repair remains capped at two attempts.
- **Keep Android honest.** Preview quality is intentionally different from desktop quality when a cheaper graph is necessary to protect playback continuity.
- **Keep the architecture reviewable.** Large orchestration responsibilities have progressively moved behind smaller state, generation, session, and UI contracts while the sensitive deterministic music engine remains protected.

## Development journey

The following history summarizes the major work completed since the current development effort began, why each step was needed, and what changed as a result.

### 1. Phrase generation and Android preview baseline — PR #5

**Why:** The early generator had overlapping phrase-generation paths and an Android preview baseline that needed to become repeatable before deeper musical work could be trusted.

**Work:** Consolidated phrase generation, established the Android preview baseline, and reduced duplicate pathways that could make later fixes behave differently between environments.

**Result:** One clearer generation path and a stable preview foundation for later quality and Android-performance work.

### 2. Music Quality Lab and APK quality gate — PR #6

**Why:** Musical improvements were being discussed qualitatively. The project needed a repeatable way to prove whether a change actually improved or damaged songs.

**Work:** Added the Music Quality Lab, deterministic genre/seed benchmarking, release-quality checks, and an APK quality gate.

**Result:** Musical changes could be judged against stable metrics instead of intuition alone. This became the basis for every later Producer Brain checkpoint.

### 3. Groove intelligence and canonical drum memory — PR #7

**Why:** Drum parts needed stronger genre identity, phrase development, and memory instead of isolated bar-by-bar variation.

**Work:** Added deterministic groove intelligence, genre-native rhythmic development, canonical drum memory, transition-aware fills, and safeguards against adjacent clone bars.

**Result:** Drums gained stronger phrase continuity and genre character while remaining deterministic and compatible with the bass relationship model.

### 4. Deterministic Song DNA and producer intent — PR #8

**Why:** “More like this” needed to preserve a recognizable musical family without cloning a specific song, and generation needed a clearer upstream musical identity.

**Work:** Consolidated Song DNA and producer intent into deterministic contracts covering harmonic, rhythmic, melodic, structural, and palette direction.

**Result:** New ideas became more distinct while related generations could preserve family identity, lineage, and intent without replaying the original fingerprint.

### 5. Phrase Memory and render-time performance intelligence — PR #9

**Why:** Songs needed callbacks, phrase roles, and expressive continuity that survived from composition through playback and MIDI export.

**Work:** Added Phrase Memory, section-addressable motif memory, performance metadata, callbacks, phrase roles, and render-time interpretation.

**Result:** Musical ideas could recur intentionally across sections while composition identity remained stable and preview/MIDI expression could vary at render time.

### 6. Android preview stutter and voice-pressure repair — PR #10

**Why:** Dense arrangements could create audio gaps, cutouts, and voice pressure on Android even when the composition itself was correct.

**Work:** Tightened scheduling behavior, reduced unnecessary DSP pressure, improved voice prioritization and stealing, and protected drums, bass, and lead before lower-priority tails.

**Result:** Android playback became substantially more resilient under dense polyphony without removing the richer desktop preview path.

### 7. Adaptive groove, taste steering, and creator polish — PR #11

**Why:** Generation needed more producer-level variation and controlled adaptation while the product surface needed stronger identity and usability.

**Work:** Added adaptive groove/taste steering, bounded user preference influence, UI polish, and creator-brand presentation.

**Result:** Musical priors could respond to producer direction without collapsing diversity or determinism, and the app became clearer as a finished creative product.

### 8. Android runtime hardening and repository cleanup — PR #12

**Why:** Playback stability and repository hygiene both needed attention before another major intelligence pass.

**Work:** Hardened Android preview runtime behavior, interruption recovery, visibility handling, and click-safe release behavior while removing stale local artifacts.

**Result:** Better Android recovery and fewer repository-side distractions from generated/local files.

### 9. Producer Brain orchestration — PR #13

**Why:** The engine had many strong local systems but needed one deterministic orchestration layer capable of coordinating candidate search, critic feedback, repair, and selection.

**Work:** Completed the first bounded Producer Brain orchestration layer.

**Result:** Generation could move from “create candidates and choose one” toward “create, diagnose, repair when justified, then select under explicit quality rules.”

### 10. Repository maintenance and shared utilities — PR #14

**Why:** Repeated iteration had left stale screenshots, launcher assets, template tests, duplicated numeric helpers, and CI assumptions that made further work riskier.

**Work:** Removed stale artifacts, introduced shared numeric utilities, cleaned creator branding, and hardened CI around Node 22, Java 21, quality checks, music-quality checks, and APK builds.

**Result:** 38 files changed with a net cleanup of roughly 280 lines. The project entered later architectural work with a smaller and more predictable surface.

### 11. Legacy arrangement architecture removal — PR #15

**Why:** Old arrangement and Song DNA facades were no longer the authoritative path and created architectural ambiguity.

**Work:** Removed the legacy root arrangement engine, obsolete Song DNA facade, and facade-only regression coverage.

**Result:** 469 lines of legacy architecture were deleted. Validation passed **226/226 tests**. The Music Quality Lab established the long-running baseline of approximately **93 overall / 92 musical / 100 technical**, with **100% release** and **100% uniqueness** on the benchmark sweep.

### 12. Engine Architecture 2.0 boundary — PR #16

**Why:** Producer Brain improvements were becoming complex enough that generation orchestration needed a safer boundary around the sensitive deterministic engine.

**Work:** Added generation dispatch/API boundaries, worker plumbing, and clearer separation between producer policy, Producer Brain planning, and engine execution.

**Result:** New orchestration work could be tested independently without casually modularizing or destabilizing `src/music-engine.js`.

### 13. App-controller boundaries — PR #17

**Why:** `src/app.js` had accumulated responsibilities that made UI and runtime changes harder to reason about.

**Work:** Extracted session contracts, scale-guide logic, generation fallback behavior, and adaptive-generation responsibilities from the main app shell.

**Result:** `src/app.js` was reduced by roughly 167 lines while preserving external behavior and generation semantics.

### 14. Session runtime controller — PR #18

**Why:** Persistence, hydration, autosave, and session discard behavior needed a single testable owner instead of being scattered through the app shell.

**Work:** Added `src/core/session-runtime.js` with persisted snapshots, decode/hydration, autosave ownership, and discard cancellation.

**Result:** Storage schema compatibility was preserved while session behavior became directly testable. The merged-main APK passed the normal quality and Android build path.

## Producer Brain 2.0 — current Phase 2 work

Phase 2 began after the architecture work because the next bottleneck was no longer code organization alone. The goal became: **generate, diagnose the weakest musical problem, repair only that problem when possible, compare against the original, and keep the change only when it is actually better.**

### Checkpoint 1 — weakness-aware search

**Why:** Extra candidate auditions previously spent CPU generically even when the critic already knew what was weak.

**Work:** Upgraded Producer Brain metadata to v2 and added bounded weakness-aware expansion. After the deterministic base pool, the best candidate's weakest dependency group can steer additional auditions toward the corresponding composition route. Explicit user candidate counts and composition routes remain authoritative.

**Result:** Search became critic-directed without increasing the hard **12-candidate ceiling** or breaking deterministic seeds.

### Checkpoint 2 — repair acceptance gate

**Why:** A regenerated repair could improve one score while quietly damaging the song elsewhere.

**Work:** Added `evaluateRepairAcceptance` and explicit protection for target gain, total score, balance, creative floor, critical dimensions, scale safety, Phase-9 quality, release readiness, and clean melodic dialogue where relevant.

**Result:** Rejected repairs remain visible in diagnostics and consume their bounded attempt budget, but can no longer satisfy the adaptive target or win final selection.

### Checkpoint 3 — 2–8 bar surgical repair and surgical-vs-whole selection

**Why:** Many musical weaknesses are local. Rewriting a full candidate to fix two weak bars caused unnecessary collateral changes.

**Work:** Reused Critic 7 phrase windows to diagnose deterministic **2–8 bar** repair spans, regenerate only the relevant dependency lanes, preserve everything outside the window byte-for-byte, and compare the surgical version against the already-generated whole repair. Surgical locality wins close calls; a whole rewrite must be materially better.

**Result:** Verified surgical cases improved local phrase scores while preserving material outside the repair window. Producer-facing outcomes now classify decisions as `improved-target`, `improved-balance`, `rejected-no-gain`, or `rejected-regression`.

### Checkpoint 4 — specialized and precision repair strategies

**Why:** A generic local rewrite still wasted repair attempts because density, groove, transitions, dynamics, repetition, cadence, and harmony are different musical problems.

**Work:** Added dimension-specific strategies, then measured them with the permanent Repair Effectiveness Lab. Global statistical weaknesses such as memory, repetition, and drum-variety were routed away from inappropriate local surgery so repair CPU could be spent on genuinely local defects. Transition and performance repair were converted from broad regeneration into source-preserving precision edits.

**Result:** On the fixed 48-song / 96-attempt calibration matrix, overall targeted-repair acceptance climbed from the original **3%** to **76%** after routing and precision work. Transition repair improved from roughly **10% to 100% acceptance** and performance repair from roughly **8% to 100%**, without increasing candidate count.

### Checkpoint 5 — precision cadence repair

**Why:** Phrase/cadence repair remained one of the lowest-yield paths and broad melodic rewrites were causing genre-authenticity and melody/counterpoint-separation regressions.

**Work:** Added a source-preserving cadence alternative that edits only the section-ending landing inside the diagnosed phrase window, avoids moving melody onsets, prefers tonic/chord landing pitches, and keeps the whole-song cadence repair as a scored fallback.

**Result:** On the fixed calibration set, phrase-cadence acceptance improved from **11% to 33%**. Average accepted cadence gain improved from **2.00 to 2.33**, and average total-score delta improved from **-0.89 to +0.11**. Phase-40 interlock reconciliation remained green.

### Checkpoint 6 — localized arrangement and density repair

**Why:** Arrangement/story-arc repair and density repair were still rewriting more music than necessary, while an experimental voice-leading surgery needed evidence before it could be trusted.

**Work:**

- Added `arrangement-energy-arc`, which rebalances section energy against the existing blueprint using bounded velocity shaping and minimal support-note density edits instead of regenerating the arrangement.
- Converted density build/thin behavior into surgical support-material edits inside the diagnosed window while preserving drums and the melody hook lane.
- Tested octave-only voice-leading surgery across a wider seed matrix and removed it after it produced **0% surgical effectiveness**; the proven whole-harmony fallback remains available.
- Added permanent real-seed regressions for arrangement tension improvement, surgical density wins, and harmony fallback behavior.

**Result:** On the fixed 48-song / 96-attempt matrix:

- overall repair acceptance improved from **78% to 81%**;
- arrangement precision reached **80% acceptance**;
- `tensionFollow` reached **100% acceptance (4/4)**;
- density reached **50% acceptance**, with **50% surgical wins** and **0% broad fallback**;
- `harmony-foundation` retained **67% acceptance** through the proven fallback path;
- average candidate count remained **9**, maximum **9**;
- targeted repair remained capped at **2 attempts**.

## Current validation snapshot

The current Phase 2 branch has been validated through the canonical `Build MIDI Arcade APK` workflow after all temporary diagnostic/codemod tooling was removed.

- **264 tests / 264 passed / 0 failed**
- Web build quality gate: **92 buttons / 0 broad legacy transitions**
- Music Quality Lab: **93 overall / 92 musical / 100 technical**
- Creative floor: **74**
- Release gate: **100%**
- Unique generated output in the benchmark: **100%**
- Subsystem averages: **harmony 97.6 / groove 85.9 / phrasing 87.5 / arrangement 94.3 / production 93.9**
- Weakest current genre in the canonical benchmark: **Techno**
- Weakest global subsystem: **Groove (85.9)**
- Lowest aggregate critic dimension: **Density (79.5)**
- Android Capacitor sync: passed
- Gradle `assembleDebug`: passed with **154 actionable tasks**

The canonical Music Quality Lab intentionally remains near the established **93/92** baseline because it uses explicit candidate budgets, and explicit candidate budgets deliberately disable automatic Producer Brain expansion. Phase 2 is improving **repair effectiveness, locality, decision quality, and collateral-damage control**, not inflating that baseline by changing the benchmark rules.

## Current architecture and invariants

The browser application is split across focused state, storage, generation, workspace, rendering, playback, session, and control-catalog modules under `src/core/` and `src/ui/`. `src/app.js` remains the integration shell.

The deterministic music engine remains intentionally protected:

- no unseeded `Math.random()` in generation;
- same seed + same config remains reproducible;
- explicit `candidateCount` disables automatic weakness search;
- explicit `compositionRoute` is never overridden;
- hard candidate ceiling: **12**;
- targeted repair budget: **2**;
- key/scale safety is preserved;
- MIDI remains Type-1 and multitrack;
- release, novelty, interlock, Phrase Memory, Android/audio, and UI contracts are regression-tested;
- heavy generation work belongs in the worker path rather than idle UI execution.

## MIDI input and export

Android uses a small Capacitor bridge over `MidiManager`, so class-compliant USB and native Android MIDI inputs can be discovered without media-library or storage permissions. The web build can use already-authorized Web MIDI devices and requests browser access only after the player presses **Find my keyboard**. Bluetooth LE MIDI (BLE MIDI) is future work and is not supported in the current release.

Export writes a temporary MIDI file to the Android app cache and opens the system save/share sheet. The Type-1 file includes tempo, time signature, corrected modal key signature, section markers, track/instrument names, program changes, volume, pan, expression, reverb, notes, velocities, and channels. Drums use General MIDI channel 10; the live piano take has its own channel and track.

For FL Studio, import the `.mid`, enable **Create one channel per track** and **Set mixer tracks for new channels**, then replace the placeholder General MIDI sounds. See [FL Studio's MIDI import guide](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/automation_midiimport.htm).

## Privacy

The production code has no accounts, ads, analytics, crash SDK, cloud service, microphone access, media-library access, or Internet permission. MIDI messages, songs, scores, and practice data stay on the device unless the user explicitly exports or shares a file. Android backup and device-transfer extraction are disabled for app data.

The source policy is in [docs/PRIVACY.md](docs/PRIVACY.md), with a bundled web version at [privacy-policy.html](privacy-policy.html). The public Google Play URL is [midi-arcade-privacy.edgarvalle520.chatgpt.site](https://midi-arcade-privacy.edgarvalle520.chatgpt.site/).

## Development

Requirements:

- Node.js 22+
- Python available on `PATH` for the simple local server
- Android builds: JDK 21 and Android SDK 36

```powershell
npm install
npm test
npm run build
npm run dev
```

Open `http://localhost:4173` for the development build.

For the full project quality gates:

```powershell
npm run quality
npm run quality:music
npm run benchmark:repairs
```

Android commands:

```powershell
npm run android:sync
npm run android:verify
npm run android:bundle
```

`android:bundle` creates the release AAB under `android/app/build/outputs/bundle/release/`. A production upload still requires the developer's private upload keystore and Play App Signing setup; secrets are intentionally not included in this repository.

## Roadmap from here

The project is currently finishing **Producer Brain 2.0** before moving deeper into the remaining roadmap:

1. **Finish Phase 2 Producer Brain 2.0** — continue improving low-yield phrase/stage-interlock cases using measured, bounded repairs rather than wider brute-force search.
2. **Songcraft & Arrangement Intelligence** — stronger intro/verse/pre/chorus/bridge/drop/outro storytelling, chorus payoff, silence, call/response, hook evolution, alternate verses, fills, and genre-specific tension arcs.
3. **Audio Engine / Android Performance 2.0** — adaptive quality tiers, scheduling telemetry, dynamic voice budgets, dropout detection, and more resilient lookahead behavior.
4. **Producer Workflow & FL Studio Bridge** — faster Create workflow, clearer advanced controls, variation history, locking/regenerating selected bars, MIDI export presets, section markers, stems, naming, and DAW-oriented metadata.
5. **Release-grade MIDI Arcade 2.0** — broader device matrix, performance budgets, dependency/security maintenance, accessibility, migration/recovery, signing/AAB/store readiness, and final release hardening.

## Launch material

- [Google Play listing copy and screenshot storyboard](docs/PLAY_STORE_LISTING.md)
- [Quality, closed-test, staged-rollout, retention, and ASO plan](docs/LAUNCH_PLAN.md)
- [Versioned brand assets](assets/brand/)
- [512 px Play icon](assets/store/play-icon-512-v2.png)
- [1024 × 500 Play feature graphic](assets/store/play-feature-graphic-1024x500-v2.png)

A top-10 chart position cannot be guaranteed by code or metadata. The launch plan instead defines measurable product quality, activation, retention, rating, and store-conversion gates that make durable growth possible.
