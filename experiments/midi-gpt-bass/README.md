# MIDI-GPT Bass Infill: Local Test

This is a development-only audition tool. It uses the official MIDI-GPT Python inference package to regenerate only a selected bass track/bar span. It writes a new MIDI file, keeps the source file untouched, and refuses to write if the protected tracks or bass notes outside the span change.

It does not connect MIDI-GPT to MIDI Arcade's Android app. It does not mark a candidate as musically approved: review the output in FL Studio and run MIDI Arcade's normal tonal, register, groove, and export checks before considering any future integration.

## Test target

The supplied `afterglow-silhouette_e-minor_90bpm_hiphop (1).mid` contains two four-bar choruses and a track named `02 Bass`. The default test targets chorus 1, bars 3–6, in E minor, with pitches limited to MIDI 35–52. The script applies that key/register as a hard pitch allow-set during MIDI-GPT sampling.

## Requirements

- Python 3.10–3.12, 64-bit.
- Internet access for first-time package and checkpoint downloads.
- CPU, Apple MPS, or CUDA device. `auto` selects the available inference device; CPU may take longer.
- Enough free disk space for PyTorch and the downloaded model checkpoint.

From the MIDI Arcade repository root:

```bash
python -m venv .venv-midi-gpt
```

Windows PowerShell:

```powershell
.\.venv-midi-gpt\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r experiments/midi-gpt-bass/requirements.txt
```

macOS/Linux:

```bash
source .venv-midi-gpt/bin/activate
python -m pip install --upgrade pip
python -m pip install -r experiments/midi-gpt-bass/requirements.txt
```

## Run the supplied song

Replace the input path with where the attached MIDI is stored. The output is a separate candidate file:

```bash
python experiments/midi-gpt-bass/regenerate_bass.py \
  --input "afterglow-silhouette_e-minor_90bpm_hiphop (1).mid" \
  --output "afterglow-silhouette-midi-gpt-bass-candidate.mid" \
  --track-name "02 Bass" --start-bar 3 --bar-count 4 \
  --key E --scale minor --pitch-min 35 --pitch-max 52 \
  --seed 20260924 --verify-repeatability
```

The first run downloads the selected pretrained checkpoint. `--verify-repeatability` runs the same request twice with the same seed and refuses to write if the generated target notes differ. Use `--start-bar 19` to test the second chorus.

## Review

1. Import the original and candidate into FL Studio on separate tracks.
2. Solo bass with drums first; check pocket, kick relationship, and low-register clarity.
3. Listen to the full arrangement and check the chorus transition.
4. Confirm MIDI-GPT produced an audition candidate, not a finished accepted part. The script verifies event preservation and pitch/register limits; producer judgment and MIDI Arcade's own quality checks remain necessary.

## Limits

- This is intentionally not called from the app worker, preview player, or Android runtime.
- Model output is checkpoint-dependent. The experiment requires the selected checkpoint to support MIDI-GPT's `pitch_mask` control; if not, it stops rather than silently dropping the key/register constraint.
- The script preserves all non-target tracks and bass notes outside the requested span at MIDI event level. It only replaces bass notes whose onset falls inside the requested bars; source notes beginning before the span and sustaining into it are preserved.
- MIDI-GPT's four-bar in-fill result does not prove genre-authentic groove. Judge the result against the source drums and compare with MIDI Arcade's baseline.
