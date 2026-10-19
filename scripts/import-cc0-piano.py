#!/usr/bin/env python3
"""Build an offline, compact CC0 piano sample subset.

Source: sfzinstruments/Osiris_Piano (CC0 1.0; see upstream LICENSE).
Requires ffmpeg. The GitHub sample-import workflow runs this script.
"""
import pathlib
import shutil
import subprocess
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / "assets/audio/instruments/piano"
# Pin the source revision for reproducible and license-auditable audio.
SOURCE_REVISION = "18c6afccb60cff458edbf7c394571783e074e1e9"
BASE = f"https://raw.githubusercontent.com/sfzinstruments/Osiris_Piano/{SOURCE_REVISION}/UC/A/"
NOTES = {
    # Osiris SFZ calls middle C "C3" (MIDI 60), not C4.
    # These keycenters were checked against its uc_mica_vl1_map.sfz.
    "C2": 48, "F2": 53, "C3": 60, "F3": 65, "C4": 72, "F4": 77,
}


def main():
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required to convert CC0 FLAC sources to WAV")
    DEST.mkdir(parents=True, exist_ok=True)
    for note, midi in NOTES.items():
        for layer in (1, 2):
            # The upstream SFZ maps vl1 to velocities 1–63 and vl2 to
            # velocities 64–127. Keep the original filename for vl1.
            suffix = "-strong" if layer == 2 else ""
            filename = f"Piano_UC_MicA_{note}_vl{layer}.flac"
            source = BASE + filename
            output = DEST / f"piano-{midi}{suffix}.wav"
            # Rebuild existing names as well: legacy files used the wrong
            # octave convention; skipping them would preserve bad tuning.
            print(f"Fetching {source}")
            with urllib.request.urlopen(source, timeout=40) as response:
                encoded = response.read()
            if not encoded.startswith(b"fLaC"):
                raise ValueError(f"Unexpected source format for {filename}")
            # Short in/out fades and 22.05k mono PCM bound APK storage.
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                 "-f", "flac", "-i", "pipe:0", "-t", "2.5",
                 "-af", "afade=t=in:st=0:d=0.008,afade=t=out:st=2.42:d=0.08",
                 "-ar", "22050", "-ac", "1", "-c:a", "pcm_s16le",
                 str(output)],
                input=encoded, capture_output=True, check=True,
            )
            print(f"Wrote {output.relative_to(ROOT)}")
    print("Review converted samples and source provenance before release.")


if __name__ == "__main__":
    main()
