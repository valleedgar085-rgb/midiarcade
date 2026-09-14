# MIDI Arcade

MIDI Arcade is a local-first Android music creation studio and deterministic multitrack MIDI song generator. It combines producer-directed generation, Song DNA, Fire / Electric / Drip creative personalities, non-destructive Shape editing, Android-safe preview playback, and DAW-ready MIDI export.

The project is designed around one rule: musical improvements only stay when they remain deterministic, measurable, export-safe, and compatible with the existing release gates.

## Current production state

`main` includes the merged Phase 5 work from PR #24: **safer MIDI export, stronger Elements, Create/Shape polish, and Create ↔ Shape Integration Phase 1**.

The merged-main `Build MIDI Arcade APK` workflow completed successfully after the Phase 5 merge. The Phase 5 branch also passed the complete repository quality gate, Music Quality Lab, Android asset sync, protected initial-HTML budget, and install-safe Preview APK build.

### Phase 5 highlights

- **Safer MIDI export**
  - generated notes cannot be lengthened beyond their sanitized export duration;
  - role-specific duration caps and section/end release protection reduce hanging notes;
  - near-duplicate same-pitch onsets collapse safely;
  - genuine retriggers receive an explicit release gap;
  - generated sustain is normalized off by default, with explicit sustain preservation available when requested;
  - export preparation remains clone-only, so preview playback is not rewritten by export cleanup.

- **Stronger Fire / Electric / Drip separation**
  - **Fire** emphasizes groove, punch, impact, density and rhythmic authority;
  - **Electric** emphasizes hooks, motion, voltage and forward energy;
  - **Drip** emphasizes harmony, space, flow and emotional color;
  - all three retain the same protected song-family identity: key, mode, tempo, bars, chord path and lineage remain authoritative.

- **Create workflow polish**
  - clearer reference → direction → generation flow;
  - stronger primary action hierarchy and advanced-control language;
  - exhaustive interaction contracts cover Create controls, workflow buttons, disclosures and Element choices;
  - new static Create interactions fail closed unless they receive explicit producer-facing copy, intent, event, accessibility and contextual-help wiring.

- **Shape Director polish**
  - clearer **Target → Musical Direction → Compare & Commit** hierarchy;
  - stronger selected states and mobile A/B/commit controls;
  - existing section, track and selected-note targeting remains non-destructive until accepted.

- **Create ↔ Shape Integration — Phase 1**
  - Create exposes **Shape this song →** after a generated song exists;
  - the handoff carries the authoritative current title, genre, key/mode, BPM, arrangement length, groove, Song DNA and selected Element;
  - Shape shows a persistent **FROM CREATE · SONG DNA** context ribbon;
  - direct Shape entry re-reads the latest generated song to prevent stale context;
  - **Edit direction** returns to Create without discarding the current song;
  - the bridge stays inside the existing app bundle so protected startup/HTML budgets are not relaxed.

## Product workflow

1. **Create** — direct the song, generate a new idea or a related version, and choose Fire, Electric or Drip when desired.
2. **Shape** — target a section, instrument or selected notes; choose a musical direction and strength; audition Before/After; Accept or Discard.
3. **Mix / Preview** — audition with the browser or Android preview engine using bounded device-aware DSP and voice budgets.
4. **Finish / Export** — export clean multitrack Type-1 MIDI for FL Studio or another DAW.

## Producer Brain and generation

Generation is deterministic and multi-candidate. Producer Brain can diagnose weak musical dimensions, steer bounded search toward the weakness, and attempt targeted repairs without increasing the hard search ceiling or bypassing explicit user controls.

Core invariants:

- same seed + same configuration reproduces the same musical result;
- generation does not use unseeded `Math.random()`;
- explicit candidate counts remain authoritative;
- explicit composition routes are never silently overridden;
- candidate search stays under the hard **12-candidate ceiling**;
- targeted repair stays capped at **2 attempts**;
- scale safety, MIDI bounds, release quality, novelty, interlock and song-family identity remain regression-tested;
- repairs must improve the diagnosed problem without causing unacceptable collateral regressions.

The Music Quality Lab remains the calibration layer for harmony, groove, phrasing, arrangement, production, release safety and generated-output uniqueness.

## Song DNA and Elements

Song DNA provides deterministic family and instance identity across harmonic, rhythmic, melodic, arrangement and performance domains. **More like this** stays inside the same musical family while producing a distinct revision instead of cloning the previous song.

Fire, Electric and Drip are producer personalities layered on top of that protected identity. They are allowed to change feel, density, motion, humanization, timbral priorities and production emphasis, but not to bypass key/mode safety, explicit user choices, MIDI bounds or release gates.

## Shape Director

Shape is the authorship workspace rather than an effects shortcut.

Supported targeting:

- section;
- track inside the selected section;
- selected notes only.

Supported change strengths:

- Touch Up;
- Reshape;
- Transform.

Shape preserves a candidate-first transaction model: the original song remains authoritative until **Accept**. Before/After audition snapshots are isolated, narrow scopes fail closed instead of widening silently, and pending Shape candidates are resolved before destructive or context-changing actions.

## MIDI input and export

Android uses a Capacitor bridge over Android MIDI APIs for class-compliant USB/native MIDI input without requesting broad media-library or storage permissions. Browser builds can use Web MIDI after explicit user interaction.

MIDI export produces a Type-1 multitrack file with tempo, time signature, key information, section markers, track names, program changes, volume/pan/expression data and note events. Drums use General MIDI channel 10.

For FL Studio, import the `.mid`, enable **Create one channel per track** and **Set mixer tracks for new channels**, then replace General MIDI placeholder sounds with your production instruments.

## Android playback

Desktop/browser preview keeps the richer synthesis/DSP path. Android uses a deliberately cheaper constrained profile with tighter scheduling and voice limits to reduce gaps, cutouts and node pressure on real devices.

The runtime prioritizes important musical voices before lower-priority tails and includes click-safe start/stop behavior, lifecycle recovery and bounded scheduling logic.

## Privacy

MIDI Arcade is local-first. Production code does not require accounts, analytics, cloud generation, microphone access or broad media-library access. Songs, MIDI input and local state stay on the device unless the user explicitly exports or shares a file.

See [docs/PRIVACY.md](docs/PRIVACY.md) and [privacy-policy.html](privacy-policy.html).

## Development

Requirements:

- Node.js 22+
- Python available on `PATH` for the local server
- Android builds: JDK 21 and Android SDK 36

```bash
npm install
npm test
npm run build
npm run dev
```

Full quality gates:

```bash
npm run quality
npm run quality:music
npm run benchmark:repairs
```

Android:

```bash
npm run android:sync
npm run android:verify
npm run android:bundle
```

`android:bundle` creates the release AAB under `android/app/build/outputs/bundle/release/`. Production signing credentials are intentionally not stored in this repository.

## Branch and merge discipline

`main` is the production baseline.

Feature branches should be short-lived and deleted after their work is merged and the merged-main APK workflow passes. New work should branch from current `main`, preserve the existing quality gates, and avoid reviving obsolete phase branches as alternate production lines.

Do not make CI green by removing meaningful assertions, skipping quality checks, weakening build budgets, or bypassing deterministic/music-safety contracts.

## Next integration work

The current Create ↔ Shape bridge is Phase 1. The next intended integration steps are:

1. **Element-aware Shape suggestions** — inherited Fire/Electric/Drip context can guide useful starting Shape directions without taking control away from the producer.
2. **Authoritative accepted Shape lineage** — accepted Shape revisions become the source for future Similar and Element branches.
3. **Continued Android and DAW validation** — prioritize real-device playback continuity and FL Studio export behavior before widening the feature surface.

## Project history

Major completed milestones include:

- phrase generation and Android preview baseline;
- Music Quality Lab and APK quality gates;
- groove intelligence and canonical drum memory;
- deterministic Song DNA and Phrase Memory;
- Android audio-pressure hardening;
- adaptive groove/taste steering;
- deterministic Producer Brain orchestration and weakness-aware repair;
- architecture/session boundaries;
- Create workflow redesign;
- Shape Director;
- Phase 5 export safety, Element separation, Create/Shape polish and Create ↔ Shape integration.

For detailed implementation history, merged PRs are the authoritative record.
