# Trap reference direction

The user supplied three MP3s for Trap generation:

| Reference | Embedded artist | Duration |
| --- | --- | --- |
| TRENCHES — DaBaby x Megan Thee Stallion / CLUB Type Beat | FIRBYKIRBY | 133.0 seconds |
| GRAND — Freestyle / Hard Trap Type Beat | STORM | 131.4 seconds |
| RIVALS — Freestyle / Hard Trap Type Beat | STORM | 127.6 seconds |

## Evidence and limits

Offline analysis decodes mono audio at 11,025 Hz, computes positive spectral flux
with a 1,024-sample STFT and 128-sample hop, removes an 85-frame local median,
and checks autocorrelation peaks in the 65–180 BPM range.

| Reference | Strong pulse candidates |
| --- | --- |
| TRENCHES | approximately 81, 108 and 162 BPM |
| GRAND | approximately 73, 98 and 144–148 BPM |
| RIVALS | approximately 72, 96 and 144 BPM |

Half-time and triplet periodicities produce competing candidates. These estimates
do not establish the exact quarter-note tempo. No automatic tempo setting is
derived from them; the user's tempo remains authoritative.

One-second RMS shows TRENCHES starting at substantial energy, GRAND beginning at
lower energy and increasing later, and RIVALS increasing substantially near 21
seconds. This measures energy, not an exact section or instrument transcription.
The existing Roomier intro remains the user's pacing preference even when a
reference starts immediately.

## Musical interpretation and implementation

The design direction combines a bouncy kick vocabulary with a clear half-time
snare, grounded kick/808 replies, a recurring small melodic contour, held harmony,
and occasional exact hat subdivisions. The rhythm cells and phrases are original
generator rules. None of the recordings or their melodies are bundled or copied.

`hard-trap-pocket-v1` is explicitly selected by the app for fresh solo Trap
requests. It persists in settings and shared Groove DNA metadata. Older untagged
configurations and fusions retain their existing generation contracts. The Pop
reference profile remains intact.

- Three seeded kick cells provide bounce without rotating the kick every bar.
- Reuse probability/density choices within a two-bar pocket.
- Retain the main half-time snare and existing strict Trap timing envelope.
- Keep ordinary hats readable; authorize triplet bursts on four/eight-bar answers.
- Triplets set to zero disables both triplet transforms.
- Give bass every kick pulse as an available anchor, with a few short replies.
- At normal bass density, preserve the first two available pulses in each harmony
  window. Density zero remains a hard off switch.
- Hold bass roots through the statement; reserve approaching motion and harmonic
  lifts for the turnaround. Scale, octave and final pitch authorities still apply.
- Use original two-bar melodic loops with six events, a small contour, a recurring
  opening gesture and space at the end of each bar.
- Hold chords underneath instead of choosing continuous chord arpeggios.
- Let the lead statement settle before developing its answer.

Manual Variation, Evolution, Surprise and tempo are not replaced. Roomier keeps
its longer song and gradual intro entrances. The specialist director reconstructs
the same reference pocket for repairs rather than silently reverting to legacy
Trap grammar.

Regression coverage checks actual generated root weighting, usable bass activity,
source/director pulse parity, original motif repetition and rests, exact triplets,
manual values, scale safety, note bounds, zero-density requests, related songs,
the worker-facing generation boundary and unchanged release thresholds. Listening
feedback remains necessary; critic scores do not establish musical enjoyment.
