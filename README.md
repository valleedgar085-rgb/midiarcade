# MIDI Arcade

MIDI Arcade is an **Android-first, local-first producer workstation and deterministic multitrack MIDI song generator**. It combines producer-directed generation, Song DNA, Creative Genome, Fire / Electric / Drip creative personalities, non-destructive Shape editing, Android-safe preview playback, and DAW-ready MIDI export.

The product rule is simple: musical improvements only stay when they remain deterministic, measurable, export-safe, device-safe, and compatible with the existing release contracts.

> **Canonical roadmap:** [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md)
>
> Merged pull requests remain the authoritative implementation history. The direction document defines what MIDI Arcade is becoming and what should happen next.

## Current production state

`main` is currently at **9a89f03**, the merged **Core hardening** checkpoint.

The latest fully validated branch recorded **569 / 569 tests passing**, Music Quality Lab **94 overall / 92 musical / 100 technical**, creative floor **77**, release **100%**, generated-output uniqueness **100%**, plus successful Android asset sync and install-safe Preview APK assembly.

Important production work now includes:

- **Phase 9E–9I** — Creative Range, broader Creative Genome consumption, Surprise Budget, Snare Bounce, and section-aware drum evolution;
- **Track A1 authority work** — accepted Shape revisions remain canonical and section-variation audition stays outside committed song state;
- **Solar Pop UI foundation** — the existing Create → Shape → Mix → Finish workflow now shares one visual system;
- **role-safe instrument policy** and **profile-driven genre arrangement/layering**;
- **Track Aura v1** and smarter deterministic song naming;
- **core hardening** — shared generation finalization, canonical genre/note contracts, preference-only session persistence, worker recovery, deterministic helpers, quality-stage execution, diagnostics, telemetry isolation, and safer store/session boundaries.

Phase 9I is now a historical engine milestone rather than the current production label.

No critic/release thresholds, candidate ceilings, repair budgets, scale/MIDI safety contracts, fusion calibration, timeout ownership, deterministic behavior, or Android audio budgets should be weakened to extend the app.

## Product direction

The app is shifting from **engine expansion** to **product convergence**.

The north-star workflow is:

1. **Create** — decide what song to make and generate New, Similar, or an Element-guided version.
2. **Shape** — target a section, track, or selected notes; stage a musical change; compare Before/After; Accept or Discard.
3. **Mix** — judge and balance the composition with producer-readable level, velocity, gate, pan/space, mute/solo, and instrument controls.
4. **Finish** — export/share predictable Type-1 multitrack MIDI for FL Studio or another DAW.

The active roadmap is **Track A: Workflow Convergence**. A1 authority work is substantially implemented; the current checkpoint is explicit end-to-end proof that Create → Shape → Mix → Finish → back → Similar all observe the same committed song and coherent history. After that, work advances in order through A2 Create simplification, A3 Shape intelligence, A4 Mix balance, and A5 Finish/export handoff. Engine expansion resumes only after the product experience is coherent and physical Android validation is repeatable.

See [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md) for the complete plan, acceptance philosophy, UI direction, and execution order.

## Producer Brain and generation

Generation is deterministic and multi-candidate. Producer Brain can diagnose weak musical dimensions, steer bounded search toward the weakness, and attempt targeted repairs without bypassing explicit user controls.

Core invariants:

- same seed + same configuration reproduces the same musical result;
- generation does not use unseeded `Math.random()`;
- explicit candidate counts remain authoritative;
- explicit composition routes and hard-off switches are never silently overridden;
- candidate search stays under the hard **12-candidate ceiling**;
- targeted repair stays capped at **2 attempts**;
- scale safety, MIDI bounds, release quality, novelty, interlock, fusion calibration, and song-family identity remain regression-tested;
- repairs must improve the diagnosed problem without unacceptable collateral regression;
- stale/timed-out generation work cannot regain authority over newer state.

The Music Quality Lab remains the calibration layer for harmony, groove, phrasing, arrangement, production, release safety, fusion behavior, and generated-output uniqueness.

## Song DNA, Creative Genome, and Elements

Song DNA provides deterministic family and instance identity across harmonic, rhythmic, melodic, arrangement, and performance domains. **More like this** stays inside the same musical family while producing a distinct revision instead of cloning the previous song.

Creative Genome provides deterministic higher-level creative strategy. Creative Range exposes calibrated Familiar / Fresh / Wild envelopes while the neutral default preserves ordinary generation behavior.

Fire, Electric, and Drip are producer personalities layered on top of protected song identity:

- **Fire** — groove, punch, density, rhythmic authority;
- **Electric** — hooks, motion, voltage, forward energy;
- **Drip** — harmony, space, flow, emotional color.

They may change feel, density, motion, humanization, timbral priorities, and production emphasis, but they do not bypass key/mode safety, explicit user choices, MIDI bounds, release gates, or family lineage.

## Shape Director

Shape is an authorship workspace rather than an effects shortcut.

Supported targeting:

- section;
- track inside the selected section;
- selected notes only.

Supported strengths:

- Touch Up;
- Reshape;
- Transform.

Shape preserves a candidate-first transaction model: the original song remains authoritative until **Accept**. Before/After snapshots are isolated, narrow scopes fail closed instead of widening silently, and pending Shape candidates are resolved before destructive or context-changing actions.

## Mix and Android playback

Desktop/browser preview keeps the richer synthesis/DSP path. Android uses a deliberately constrained profile with tighter scheduling and voice budgets to reduce gaps, cutouts, clicks, pops, and Web Audio node pressure on real devices.

The runtime prioritizes important musical voices before lower-priority tails and includes click-safe start/stop behavior, lifecycle recovery, bounded scheduling, and stale-generation isolation.

The product direction intentionally keeps Mix focused on **musical balance and reliable audition**, rather than turning MIDI Arcade into a miniature DAW.

## MIDI input and export

Android uses a Capacitor bridge over Android MIDI APIs for class-compliant USB/native MIDI input without requesting broad media-library or storage permissions. Browser builds can use Web MIDI after explicit user interaction.

MIDI export produces a Type-1 multitrack file with tempo, time signature, key information, section markers, track names, program changes, volume/pan/expression data, and note events. Drums use General MIDI channel 10.

Export preparation remains clone-only: cleanup for exported MIDI must not rewrite the authoritative preview song.

For FL Studio, import the `.mid`, enable **Create one channel per track** and **Set mixer tracks for new channels**, then replace General MIDI placeholder sounds with production instruments.

## Privacy

MIDI Arcade is local-first. Production code does not require accounts, analytics, cloud generation, microphone access, or broad media-library access. Songs, MIDI input, and local state stay on the device unless the user explicitly exports or shares a file.

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

Feature branches should be short-lived and deleted after merge and merged-main validation. New work should branch from current `main`, preserve the existing quality gates, and avoid reviving obsolete phase branches as alternate production lines.

Do not make CI green by removing meaningful assertions, skipping quality checks, weakening build budgets, increasing search budgets without evidence, or bypassing deterministic/music-safety contracts.

Physical Android validation remains mandatory for behavior that automated browser/Node tests cannot establish, including sustained playback and device lifecycle behavior.

## Repository hygiene

Generated output stays generated. Do not commit `www/`, Android build directories, APK/AAB files, temp diagnostics, local signing material, or transient benchmark output.

Long-lived documentation should be limited to:

1. the canonical product direction;
2. durable subsystem contracts;
3. privacy/release documentation.

Temporary phase acceptance checklists should be removed after merge and validation because Git history already preserves them.

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
- Create workflow redesign and Shape Director;
- safer MIDI export and stronger Element separation;
- critic-gated output-quality evolution and fusion calibration;
- Create ↔ Shape authoritative lineage;
- generation timeout ownership and stale-result isolation;
- Creative Range and broader Creative Genome consumption;
- critic-gated snare bounce and section-aware drum evolution through Phase 9I.

For implementation detail, merged PRs are the authoritative record.
