# Elemental Producer System (EPS)

## Purpose

MIDI Arcade generates one parent song idea, then produces three related interpretations of that same musical family:

- 🔥 Fire — heat, punch, impact
- ⚡ Electric — motion, spark, energy
- 💧 Drip — flow, space, emotion

Mood and Element are separate concerns. Mood answers “what kind of song is this?” while Element answers “how is this version produced?” Balanced, Romantic and Club therefore remain mood/intention concepts rather than A/B/C variation identities.

## Element meters

Element strength is stored internally as a normalized value from `0.0` to `1.0`. The UI may display the same value through a branded producer meter:

- Fire: Heat, `0–3000 °F`
- Electric: Charge, `0–3000 V`
- Drip: Flow, `0–3000 mL/min`

The meter is functional, not decorative. A displayed value is deterministically derived from the same intensity used by generation. Maximum intensity means maximum musically safe character, not permission to bypass quality or mix guardrails.

## Engineering rules

1. One responsibility per layer. Genre defines style grammar, Mood defines emotional intent, Song DNA defines family identity, Element defines production personality, Element Intensity defines strength, and Critic protects quality.
2. Generate one parent before three children. Fire, Electric and Drip derive from the same source song rather than being three unrelated generations.
3. Preserve family identity by default. Key, mode, tempo, bar count and explicit chord path remain locked across the trio when known.
4. Variations must differ musically, not only in metadata. Fire must create impact differences, Electric motion/timbre differences, and Drip space/phrasing differences.
5. Element meters must map directly to normalized generation intensity.
6. Auto is the default authority for supported controls.
7. Manual always outranks Auto. Once a user manually changes a supported control, generation must not silently overwrite it until Auto is explicitly restored.
8. Instrument programs follow the same authority model: `track:<id>:program` present in Auto state means Producer Brain may choose the sound; absence means the selected program is pinned.
9. Auto decisions must be deterministic for the same seed, preferences, mood, element and intensity.
10. Element influence is bounded. It cannot bypass scale safety, MIDI bounds, voice-leading constraints, polyphony budgets, mix headroom, performance limits or release gates.
11. 3000 is not automatically better. The Critic may attenuate transformations that damage the candidate while retaining the requested elemental identity.
12. Keep candidates comparable. The trio should normally share key and tempo and should preserve recognizable family DNA.
13. Mood and Element combine rather than replace each other. Romantic Fire, Romantic Electric and Romantic Drip must all remain Romantic; Club Drip must remain Club.
14. Similar inherits the selected lineage. The chosen elemental variation becomes the next source family when the user asks for more like it.
15. Variation switching must be click-safe on Android and must not tear down active audio nodes abruptly.
16. Candidate budgets stay explicit and bounded; EPS must not create an unbounded three-times search explosion.
17. Critic evaluates both individual candidate quality and useful separation between the three elemental personalities.
18. Session persistence stores preferences and authority state independently from the active song. Relaunch still follows the empty-studio startup contract.
19. Reset returns supported controls to the intended Auto-first baseline.
20. Low-risk defects discovered during EPS work are fixed immediately with regression coverage; risky architectural work stays isolated.
21. Never make CI green by deleting meaningful assertions. Change tests only when the intended product contract changed.
22. Every behavior change needs regression coverage, especially determinism, intensity bounds, family locks, personality separation, manual program protection, Auto program rotation, persistence, reset, Similar lineage and audio transitions.
23. Existing calibrated music-engine safety and release gates remain authoritative unless evidence supports a replacement.
24. Keep the main UI simple: element identity, branded intensity reading, concise personality copy, and clear Auto/Manual state. Internal critic metrics stay secondary.
25. Do not merge partial EPS work to `main`. Merge only after the quality suite and Android APK are green and the phone behavior is acceptable.
26. Real-device Android behavior is part of the release gate: repeated Generate, rapid element switching, Play/Pause, section jumps, background/resume, program pinning, relaunch and MIDI export.
27. Preserve rollback points with small conceptual commits.
28. Green CI is necessary but not sufficient; musical coherence and UX behavior must also be checked.
29. Prefer measurable improvement using critic results, variation separation, generation latency, playback stability, memory use and test coverage.
30. Keep stable `main`; EPS work remains on the Phase 3 feature branch until validated.
