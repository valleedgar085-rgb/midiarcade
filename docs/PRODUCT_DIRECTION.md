# MIDI Arcade — Product Direction

**Canonical product plan · refreshed September 18, 2026**

This document is the forward-looking source of truth for MIDI Arcade. Merged pull requests remain the authoritative implementation history; this file defines what the app is becoming, what matters next, and which contracts future work must preserve.

## 1. Product thesis

MIDI Arcade is an **Android-first, local-first producer workstation for turning musical direction into editable, DAW-ready MIDI songs**.

The app should feel less like a random song generator and more like a fast producer partner:

- the producer gives a clear musical direction;
- MIDI Arcade creates a coherent song family rather than disconnected loops;
- the producer can reshape sections, instruments, and selected notes without losing authorship;
- playback is reliable enough to judge the idea on a phone;
- the result exports cleanly into FL Studio or another DAW for final production.

### What MIDI Arcade is not

MIDI Arcade is not trying to become:

- a cloud-dependent AI chat product;
- a full replacement for a DAW;
- a sample marketplace or social network;
- a feature collection where every musical idea gets another permanent control;
- a generator that improves scores by weakening quality thresholds.

The product wins by making **high-quality MIDI composition, variation, shaping, and export unusually fast and controllable on Android**.

## 2. Current production baseline

`main` is currently at **9a89f03** (`Core hardening: unify generation contracts and fix Shape/session risks (#56)`). Phase 9I remains an important historical engine milestone, but it is no longer the production baseline.

Since Phase 9I, production has also absorbed:

- **Track A1 authority work** that keeps section-variation audition outside canonical song state and protects accepted Shape authority;
- the **Solar Pop UI foundation** across the existing Create → Shape → Mix → Finish shell;
- shared, role-safe instrument program selection;
- profile-driven genre arrangement and deterministic probabilistic layering;
- **Track Aura v1** plus smarter deterministic song naming;
- GitHub Actions APK job repair;
- a broad **core hardening pass** that unified generation finalization, genre/note contracts, session boundaries, worker recovery, deterministic helpers, quality-stage execution, diagnostics, and telemetry isolation.

The latest fully validated core-hardening branch recorded:

- **569 / 569 repository tests passing**;
- Music Quality Lab: **94 overall / 92 musical / 100 technical**;
- creative floor **77**;
- release **100%**;
- generated-output uniqueness **100%**;
- Android asset sync and install-safe Preview APK assembly passing.

The current production foundation therefore already includes:

- deterministic Song DNA and Creative Genome;
- New, Similar, producer variations, section variations, and track rerolls;
- Fire / Electric / Drip producer personalities;
- Creative Range with neutral default plus Familiar / Fresh / Wild opt-in;
- phrase, groove, arrangement, return, repetition, density, register, performance, snare-bounce, and section-drum refinement;
- profile-driven genre arrangement and deterministic layering;
- accepted Shape revisions as authoritative musical state;
- generation timeout ownership plus recoverable worker fallback;
- shared generation finalization across worker and synchronous paths;
- canonical genre aliases and MIDI velocity ceiling contracts;
- preference-only session persistence with UI/session boundary separation;
- Track Aura and deterministic smarter song naming;
- Android-constrained preview audio and multitrack MIDI export.

The next stage remains **product convergence**. The immediate checkpoint is to close Track A1 with explicit end-to-end cross-workspace authority/history evidence, then advance A2 → A3 → A4 → A5 without opening another parallel engine phase.

## 3. North-star workflow

The entire app should reinforce one loop:

**Create → Shape → Mix → Finish**

### Create — decide what song to make

Create owns musical intent and generation.

The first screen should answer four questions quickly:

1. **What are we making?** — genre/fusion, key/scale, BPM, length.
2. **How should it feel?** — energy, groove, density, Creative Range.
3. **What family should it belong to?** — New, Similar, Fire, Electric, Drip.
4. **What happens next?** — generate, audition, then continue to Shape.

Create should expose fewer simultaneous decisions. Advanced controls remain available, but the default path must be understandable without knowing the engine architecture.

### Shape — direct the song, not the effects

Shape owns musical revision.

The producer chooses:

- **Target** — section, track, or selected notes;
- **Direction** — the musical change to make;
- **Strength** — Touch Up, Reshape, or Transform;
- **Compare** — Before / After;
- **Commit** — Accept or Discard.

Shape suggestions may use Song DNA, Element identity, critic weaknesses, and section role, but suggestions stay advisory. They must never silently broaden scope or bypass explicit preserve locks.

### Mix — make the idea readable and playable

Mix should become the simplest possible musical balance workspace, not a miniature DAW mixer.

Its job is to let the producer judge the composition by controlling:

- instrument level;
- velocity emphasis;
- note length/gate;
- pan/space where supported;
- mute/solo;
- instrument/program choice when explicitly desired.

The interface should favor **musical meaning** over raw implementation values. Mobile playback continuity is part of this workspace's definition of quality.

### Finish — trust the export

Finish owns delivery.

The producer should be able to see what will be exported, choose the appropriate MIDI profile, and send the result to FL Studio or another DAW with predictable track identity and note behavior.

Finish should emphasize:

- clean Type-1 multitrack MIDI;
- stable track names and channels;
- safe note lengths and release behavior;
- section/navigation metadata;
- explicit export/share actions;
- no hidden musical rewrite during export preparation.

## 4. Product principles

### 4.1 Producer authority first

Automatic intelligence may recommend and audition. It does not silently override explicit producer choices.

### 4.2 One authoritative song state

At every point there must be one clear current song. Accepted Shape edits, generation results, history, playback, Similar, Elements, and export must agree on that authority.

### 4.3 Deterministic creativity

Same seed + same configuration must remain reproducible. Variety comes from intentional deterministic strategy, not unseeded randomness.

### 4.4 Candidate quality over candidate quantity

Do not raise quality by expanding search indefinitely. Improve the musical intelligence of bounded candidates and the critic's ability to choose them.

### 4.5 Mobile reliability is a musical feature

A song that scores well but cannot play continuously on the target Android device is not release-ready.

### 4.6 Export is part of composition quality

Preview and exported MIDI must agree on note identity, timing intent, velocity/gate interpretation, and instrument roles closely enough that the producer can trust the handoff.

### 4.7 Reduce permanent UI surface

New engine capability does not automatically deserve a new top-level control. Prefer policy, context, progressive disclosure, and existing musical controls before adding interface surface.

## 5. Hard contracts that remain frozen

Future work must not weaken these to make a feature pass:

- critic and release thresholds;
- candidate-search ceilings;
- targeted repair budgets;
- deterministic-seed behavior;
- explicit user controls and hard-off switches;
- scale safety and MIDI bounds;
- song-family / lineage integrity;
- Similar restraint relative to New;
- fusion calibration and fail-closed behavior;
- timeout ownership and stale-generation isolation;
- Shape candidate-first transaction safety;
- export clone-only preparation;
- Android audio-pressure budgets;
- build-quality/startup budgets;
- physical-device validation where a contract is inherently device-specific.

If a new idea conflicts with one of these contracts, the new idea changes — the contract does not.

## 6. New roadmap

The next roadmap shifts from **engine expansion** to **product convergence**.

The roadmap uses **Track A / B / C** instead of new phase numbers because historical implementation phases already exist elsewhere in the codebase. This keeps future product planning distinct from old architecture and UI milestone labels.

### Track A — Workflow convergence

#### A1. Canonical workspace model

Create one shared song-context model across Create, Shape, Mix, and Finish.

Goals:

- current song identity is visible and consistent in every workspace;
- navigation never creates a stale copy of song state;
- generation/history/Shape authority is explicit;
- workspace transitions preserve intent without hidden regeneration.

Acceptance evidence:

- cross-workspace state-contract tests;
- history tests across Create → Shape → Mix → Finish → back;
- no duplicate source of truth for current song or accepted Shape revision.

#### A2. Create simplification

Reorganize Create around **Song / Feel / Structure / Generate** instead of exposing implementation-oriented controls at the same visual level.

Goals:

- New and Similar are unmistakable primary paths;
- Fire / Electric / Drip remain creative branches, not competing primary navigation;
- Creative Range becomes an understandable creativity envelope;
- advanced generation controls are progressively disclosed;
- the loading/progress experience explains what is happening without pretending to show fake precision.

Do not remove supported controls simply to simplify the screen; reorganize them and preserve their contracts.

#### A3. Shape intelligence

Use existing Song DNA, Creative Genome, Element identity, critic diagnostics, phrase/section role, and accepted lineage to produce **ranked Shape starting suggestions**.

Goals:

- suggestions are specific to the selected target;
- suggestions explain the intended musical result;
- one tap can stage a direction, but never auto-commit it;
- accepted Shape edits become the unquestioned source for subsequent Similar/Element branches.

#### A4. Mix as musical balance

Tighten Mix around the controls that materially affect audibility and export.

Goals:

- remove or hide duplicate presentation controls;
- present level, velocity, and gate in producer-readable terms;
- make mute/solo/program authority obvious;
- keep playback and export interpretation aligned;
- avoid adding effect chains that turn Mix into a DAW clone.

#### A5. Finish and handoff

Make export status and intent obvious before the file leaves MIDI Arcade.

Goals:

- one clear default DAW-ready MIDI export;
- advanced export profiles only when they materially differ;
- clear track list and section summary;
- reliable Android share/save behavior;
- FL Studio handoff instructions stay concise and accurate.

### Track B — Musical coherence and uniqueness

After Track A makes the workflow coherent, resume engine work only where measured listening/quality evidence shows a real musical weakness.

Priority order:

1. **section-to-section storytelling** — stronger cause/effect between build, payoff, return, and outro;
2. **instrument conversation** — fewer unrelated simultaneous ideas, stronger call/response and foreground rotation;
3. **hook identity** — memorable motifs that develop without clone-like repetition;
4. **groove family memory** — drums and bass remain recognizably related while sections evolve;
5. **generation-to-generation novelty** — consecutive New songs should not converge on the same arrangement/rhythm fingerprints;
6. **Similar usefulness** — recognizable family DNA with enough musical change to justify another version.

Every change remains bounded and critic/release gated. Prefer improving existing subsystems over creating another permanent parallel repair layer.

### Track C — Android release confidence

Treat physical Android validation as a repeatable release discipline instead of an occasional final check.

Required device checks should cover:

- sustained playback;
- loop boundaries;
- pause/resume/seek;
- background/foreground recovery;
- dense arrangements;
- Fire / Electric / Drip audition;
- generation timeout → retry ownership;
- history after timeout/retry;
- subsequent generation after worker disposal;
- MIDI export/share/open in a DAW workflow.

Automated tests prove deterministic state contracts; physical testing proves device behavior that cannot be established from Node/browser tests alone.

## 7. Repository and architecture direction

### Consolidate rather than multiply

Prefer extending an existing subsystem when its responsibility already matches the change. New modules should represent a durable domain boundary, not a one-PR phase artifact.

### Keep phase names historical

Phase names are useful in PR history, but user-facing architecture and long-lived documentation should use product-domain names: generation, Song DNA, Shape, playback, export, session, quality.

### Documentation policy

Keep only three classes of long-lived docs:

1. **canonical direction** — this document;
2. **durable subsystem contracts** — for example Shape Director or Element behavior;
3. **policy/legal/release documentation** — privacy and release-critical instructions.

Temporary acceptance checklists should be removed after the work is merged and validated. Git history remains the archive.

### Generated files stay generated

Do not commit:

- `www/` build output;
- Android build directories;
- APK/AAB files;
- temp diagnostics;
- local signing material;
- transient benchmark output.

## 8. UI direction

The visual system should support speed, hierarchy, and confidence:

- one dominant action per workspace state;
- large touch targets on Android;
- fewer competing cards above the fold;
- current song identity always visible but compact;
- advanced detail available without making the default path dense;
- Fire / Electric / Drip can keep distinct personality, but they must remain part of one coherent design system;
- loading, error, timeout, empty, and disabled states are designed states, not afterthoughts;
- landscape support remains functional, but phone portrait is the primary layout target.

The app should feel like **a modern producer instrument**, not a configuration dashboard.

## 9. Success metrics

We should judge future work using evidence in four buckets.

### Musical

- Music Quality Lab and release gauntlet stay green;
- weak dimensions improve without collateral regressions;
- New songs remain meaningfully diverse;
- Similar remains recognizably related but musically distinct;
- section roles and returns are audibly intentional.

### Workflow

- fewer steps from open → generated song → shaped song → export;
- fewer ambiguous duplicate controls;
- history/undo behavior stays understandable;
- no stale state across workspace changes or generation retries.

### Android

- installable APK from the exact validated head;
- stable playback on the target phone;
- no recurring cutouts, stuck transport, stale loading state, or worker poisoning;
- export/share works on-device.

### Engineering

- repository quality gate remains green;
- no threshold weakening;
- no unseeded randomness;
- no unnecessary candidate-budget growth;
- no tracked build artifacts or stale acceptance files;
- documentation reflects current `main` rather than an old phase.

## 10. Immediate execution order

1. **Refresh canonical docs to the actual merged-main baseline.**
2. **Close Track A1 with executable Create → Shape → Mix → Finish → back → Similar authority/history coverage.**
3. **Repair only any state fork exposed by that acceptance test; otherwise leave runtime behavior unchanged.**
4. **Advance A2 Create simplification without removing supported capability.**
5. **Advance A3 Shape intelligence and accepted-lineage authority.**
6. **Advance A4 Mix around producer-readable musical balance and reliable audition.**
7. **Advance A5 Finish around trusted default MIDI handoff and explicit export intent.**
8. **Complete repeatable physical Android validation under Track C.**
9. **Only then resume measured engine expansion under Track B.**

That order is intentional: MIDI Arcade already has substantial composition intelligence. The highest-leverage work is to make the whole product behave and read like one instrument while preserving every frozen deterministic, musical, export, and Android contract.
