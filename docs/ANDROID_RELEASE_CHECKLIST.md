# MIDI Arcade Android Release Checklist

This is the repeatable **Track C** device gate. Automated checks establish code-level contracts; this checklist establishes behavior on real Android hardware. A build is not physically validated until every required device item is recorded against the exact APK being tested.

## 1. Identify the build

Record before testing:

- Commit SHA:
- APK filename:
- APK SHA-256:
- Workflow/run:
- Device model:
- Android version:
- Install path: fresh install / upgrade install
- Tester/date:

Do not substitute a different APK midway through the run. If the APK changes, start a new checklist.

## 2. Automated pre-device gate

Run:

```bash
npm run test:android-release
npm test
npm run quality:music
npm run build
node scripts/check-build-quality.js
npm run android:sync
```

Required result: every command passes without weakening critic/release thresholds, search budgets, deterministic generation, MIDI safety, export contracts, UI/build budgets, or Android audio budgets.

## 3. Physical playback

- [ ] Play a complete generated song from start to finish three times with no stuck note, scheduler stall, runaway voice, or unexpected stop.
- [ ] Enable loop and cross the full-song loop boundary at least five times with no burst, duplicate transient, missing first beat, or transport jump.
- [ ] Pause and resume at least five positions across intro, verse, transition, chorus/drop, and outro.
- [ ] Seek while stopped, then Play from the requested position.
- [ ] Seek while playing at least five times; stale scheduled audio clears and the new position owns playback.
- [ ] Run one dense/high-energy arrangement; preview stays responsive and the groove remains intact.

## 4. Android lifecycle and route recovery

- [ ] Background the app while playing and return; the app remains responsive and audio is recoverable.
- [ ] Repeat background/foreground three times.
- [ ] Lock/unlock once during or immediately after playback and confirm the next Play works.
- [ ] Change an available audio route if supported (speaker/Bluetooth/wired); playback may pause or recover, but audio must not remain unusable.
- [ ] After interruption, Pause, Seek, Play, and Stop still work.

A lifecycle event may intentionally pause playback. The release requirement is recoverability and correct transport ownership, not forced background playback.

## 5. Create / Shape / Mix / Finish continuity

- [ ] Generate a new song.
- [ ] In Shape, audition Before/After without committing.
- [ ] Accept one Shape candidate and confirm Mix hears that accepted song.
- [ ] Change Level / Impact / Note Length on at least one track.
- [ ] Finish shows the same accepted song, tracks, sections, key, BPM, and bar count.
- [ ] Undo through the accepted Shape change and confirm history remains coherent.

## 6. Fire / Electric / Drip audition

For each Element:

- [ ] Fire auditions and returns to canonical song state.
- [ ] Electric auditions and returns to canonical song state.
- [ ] Drip auditions and returns to canonical song state.
- [ ] Element audition never silently replaces canonical song state.

## 7. Generation timeout / retry ownership

Use a reproducible debug or naturally occurring timeout when available.

- [ ] Start generation A and force/observe a timeout.
- [ ] Start generation B after A times out.
- [ ] A cannot replace B's song if A resolves late.
- [ ] A cannot clear B's loading/progress state.
- [ ] A cannot pop or corrupt B's history.
- [ ] After timeout disposal, a later generation C succeeds normally.
- [ ] Playback still works after the timeout/retry sequence.

If no physical timeout can be reproduced, record **NOT REPRODUCED ON DEVICE** rather than PASS. The automated ownership suite must still be green.

## 8. MIDI export / share / DAW open

- [ ] Finish exports the default full-song Type-1 multitrack MIDI.
- [ ] Android share sheet opens.
- [ ] Canceling share does not corrupt the song or block another export.
- [ ] Export again and save/share the MIDI.
- [ ] Open/import the MIDI in the target DAW.
- [ ] Track separation is preserved.
- [ ] Track names/channels are usable.
- [ ] Expected section markers/cues are present.
- [ ] Original groove/human feel is preserved unless Tight timing was explicitly selected.
- [ ] Export does not mutate the song loaded in MIDI Arcade.

## 9. Release decision

Required evidence:

- Automated release command: PASS
- Full repository tests: PASS
- Music quality gate: PASS
- Build-size/UI budgets: PASS
- Android sync/build: PASS
- Physical playback: PASS
- Lifecycle recovery: PASS
- Workflow continuity: PASS
- Element audition: PASS
- Timeout/retry: PASS, or NOT REPRODUCED ON DEVICE with automated ownership PASS
- MIDI share/open in target DAW: PASS

Record:

- Result: PASS / FAIL
- Blocking defects:
- Evidence/notes:
- Follow-up commit or issue:
