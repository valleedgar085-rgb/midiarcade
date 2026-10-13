#!/usr/bin/env python3
"""Offline, non-destructive MIDI-GPT bass infill experiment.

This tool never edits the input MIDI. It proposes a new bass part for a selected
bar range, splices only those notes into a copy, and verifies the protected
tracks and bars before writing the candidate file.
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
from collections import defaultdict, deque
from pathlib import Path


SCALE_INTERVALS = {
    "major": (0, 2, 4, 5, 7, 9, 11),
    "minor": (0, 2, 3, 5, 7, 8, 10),
}
PITCH_CLASSES = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
                 "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
                 "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def allowed_pitches(key: str, scale: str, low: int, high: int) -> list[int]:
    if key not in PITCH_CLASSES:
        raise ValueError(f"Unsupported key {key!r}; use a note name such as E or F#.")
    if scale not in SCALE_INTERVALS:
        raise ValueError(f"Unsupported scale {scale!r}; this spike supports major/minor.")
    tonic = PITCH_CLASSES[key]
    classes = {(tonic + interval) % 12 for interval in SCALE_INTERVALS[scale]}
    return [pitch for pitch in range(low, high + 1) if pitch % 12 in classes]


def note_message_signature(message):
    """Comparable MIDI note-event signature, excluding delta time."""
    if message.type == "note_on" and message.velocity > 0:
        return ("on", message.channel, message.note, message.velocity)
    if message.type == "note_off" or (message.type == "note_on" and message.velocity == 0):
        return ("off", message.channel, message.note,
                getattr(message, "velocity", 0) if message.type == "note_off" else 0)
    return None


def absolute_events(track):
    tick = 0
    events = []
    for order, message in enumerate(track):
        tick += message.time
        events.append((tick, order, message.copy()))
    return events


def paired_note_events(events):
    """Return paired note-on/off event indices; reject malformed note streams."""
    pending = defaultdict(deque)
    pairs = []
    for index, (_tick, _order, message) in enumerate(events):
        signature = note_message_signature(message)
        if signature is None:
            continue
        direction, channel, pitch, _velocity = signature
        key = (channel, pitch)
        if direction == "on":
            pending[key].append(index)
        elif pending[key]:
            pairs.append((pending[key].popleft(), index))
        else:
            raise ValueError(f"MIDI note-off without note-on: channel {channel}, pitch {pitch}")
    dangling = [(key, len(indices)) for key, indices in pending.items() if indices]
    if dangling:
        raise ValueError(f"MIDI has unmatched note-ons: {dangling[:4]}")
    return pairs


def note_records(events):
    records = []
    for on_index, off_index in paired_note_events(events):
        on_tick, _, on = events[on_index]
        off_tick, _, off = events[off_index]
        records.append({
            "start": on_tick,
            "end": off_tick,
            "pitch": on.note,
            "velocity": on.velocity,
            "channel": on.channel,
            "off_velocity": getattr(off, "velocity", 0) if off.type == "note_off" else 0,
            "indices": (on_index, off_index),
        })
    return records


def canonical_records(records):
    return sorted((r["start"], r["end"], r["pitch"], r["velocity"], r["channel"])
                  for r in records)


def get_program(track):
    programs = [message.program for message in track if message.type == "program_change"]
    return programs[-1] if programs else 0


def find_midi_track(midi, requested_name):
    matches = []
    for index, track in enumerate(midi.tracks):
        names = [message.name.strip() for message in track if message.type == "track_name"]
        if any(name.casefold() == requested_name.casefold() for name in names):
            matches.append(index)
    if len(matches) != 1:
        names = []
        for index, track in enumerate(midi.tracks):
            names.extend(f"{index}: {m.name}" for m in track if m.type == "track_name")
        raise ValueError(f"Expected one track named {requested_name!r}; found {matches}. Tracks: {names}")
    return matches[0]


def find_score_track(score, program, source_note_count):
    program_candidates = []
    for index, track in enumerate(score.tracks):
        if track.instrument == program:
            program_candidates.append(index)
    if len(program_candidates) == 1:
        return program_candidates[0]

    candidates = [
        index for index in program_candidates
        if sum(len(bar.notes) for bar in score.tracks[index].bars) == source_note_count
    ]
    if len(candidates) != 1:
        inventory = [
            {"index": i, "program": t.instrument, "notes": sum(len(b.notes) for b in t.bars),
             "bars": len(t.bars)}
            for i, t in enumerate(score.tracks)
        ]
        raise ValueError(
            "Could not uniquely match the named MIDI bass track to MIDI-GPT's parsed score. "
            f"Program={program}, note_count={source_note_count}, candidates={candidates}; "
            f"score_tracks={inventory}"
        )
    return candidates[0]


def bar_ticks(midi):
    numerator, denominator = 4, 4
    for track in midi.tracks:
        for message in track:
            if message.type == "time_signature":
                numerator, denominator = message.numerator, message.denominator
                break
        else:
            continue
        break
    return round(midi.ticks_per_beat * numerator * 4 / denominator), numerator, denominator


def candidate_note_events(score, score_track_index, bars, ticks_per_bar, allowed):
    track = score.tracks[score_track_index]
    events = []
    for bar_index in bars:
        if bar_index >= len(track.bars):
            raise ValueError(f"MIDI-GPT output has no target bar {bar_index + 1}.")
        for note in track.bars[bar_index].notes:
            pitch = int(note.pitch)
            if pitch not in allowed:
                raise ValueError(f"MIDI-GPT proposed pitch {pitch} outside the allowed key/register set.")
            start = bar_index * ticks_per_bar + int(note.onset_ticks) + int(getattr(note, "delta", 0))
            duration = int(note.duration_ticks)
            if duration <= 0:
                raise ValueError(f"MIDI-GPT proposed a non-positive duration for pitch {pitch}.")
            events.append((start, pitch, int(note.velocity), duration))
    if not events:
        raise ValueError("MIDI-GPT returned no bass notes for the selected chorus bars.")
    return events


def splice_notes(original_track, target_start, target_end, generated, midi):
    """Replace only note pairs whose onset is inside the selected span."""
    events = absolute_events(original_track)
    records = note_records(events)
    remove_indices = set()
    for record in records:
        if target_start <= record["start"] < target_end:
            remove_indices.update(record["indices"])

    kept = [(tick, order, message) for index, (tick, order, message) in enumerate(events)
            if index not in remove_indices]
    next_order = max((order for _tick, order, _message in kept), default=-1) + 1
    for start, pitch, velocity, duration in generated:
        if start < target_start or start >= target_end or start + duration > target_end:
            raise ValueError("Generated bass note crosses the selected four-bar boundary.")
        channel = records[0]["channel"] if records else 0
        kept.append((start, next_order, midi.Message("note_on", channel=channel,
                    note=pitch, velocity=max(1, min(127, velocity)), time=0)))
        next_order += 1
        kept.append((start + duration, next_order, midi.Message("note_off", channel=channel,
                    note=pitch, velocity=0, time=0)))
        next_order += 1

    # At a shared tick, release old voices before retriggering the same pitch.
    def event_key(item):
        tick, order, message = item
        priority = 0 if message.type == "note_off" or (
            message.type == "note_on" and message.velocity == 0) else 1
        return tick, priority, order

    kept.sort(key=event_key)
    rebuilt = midi.MidiTrack()
    previous_tick = 0
    for tick, _order, message in kept:
        message.time = tick - previous_tick
        rebuilt.append(message)
        previous_tick = tick
    return rebuilt


def verify_protected_events(before_midi, after_midi, target_track_index, target_start, target_end):
    if len(before_midi.tracks) != len(after_midi.tracks):
        raise ValueError("Candidate changed the number of MIDI tracks.")
    for index, (before_track, after_track) in enumerate(zip(before_midi.tracks, after_midi.tracks)):
        before_events = absolute_events(before_track)
        after_events = absolute_events(after_track)
        if index != target_track_index:
            if [(t, m.dict()) for t, _o, m in before_events] != [(t, m.dict()) for t, _o, m in after_events]:
                raise ValueError(f"Candidate altered protected track {index}.")
            continue
        before_records = [r for r in note_records(before_events) if not target_start <= r["start"] < target_end]
        after_records = [r for r in note_records(after_events) if not target_start <= r["start"] < target_end]
        if canonical_records(before_records) != canonical_records(after_records):
            raise ValueError("Candidate altered bass notes outside the selected bars.")


def run(args):
    try:
        import mido
        from midigpt import Score
        from midigpt.inference import (
            GenerationRequest, InferenceConfig, InferenceEngine, TrackPrompt,
        )
    except ImportError as error:
        raise RuntimeError(
            "Install the experiment requirements first: "
            "python -m pip install -r experiments/midi-gpt-bass/requirements.txt"
        ) from error

    source_path = Path(args.input).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    if source_path == output_path:
        raise ValueError("Output must be a new file; the source MIDI is never overwritten.")
    if not source_path.is_file():
        raise FileNotFoundError(source_path)

    source_midi = mido.MidiFile(source_path)
    bass_index = find_midi_track(source_midi, args.track_name)
    source_events = absolute_events(source_midi.tracks[bass_index])
    source_records = note_records(source_events)
    program = get_program(source_midi.tracks[bass_index])
    ticks_per_bar, numerator, denominator = bar_ticks(source_midi)
    start_bar = args.start_bar - 1
    bar_indices = list(range(start_bar, start_bar + args.bar_count))
    target_start = start_bar * ticks_per_bar
    target_end = target_start + args.bar_count * ticks_per_bar
    if len(source_records) == 0 or target_end > max(
        (tick for track in source_midi.tracks for tick, _order, _msg in absolute_events(track)), default=0
    ):
        raise ValueError("Selected bar range is outside the MIDI arrangement or the bass track is empty.")

    print(f"Source: {source_path.name}")
    print(f"Meter: {numerator}/{denominator}, TPQ: {source_midi.ticks_per_beat}, "
          f"bars: {args.start_bar}-{args.start_bar + args.bar_count - 1}")
    print(f"Bass: {args.track_name}, MIDI track {bass_index}, program {program}, "
          f"{len(source_records)} source notes")
    print(f"Loading MIDI-GPT checkpoint {args.model!r} on {args.device}...")

    score = Score.from_midi(str(source_path))
    score_track_index = find_score_track(score, program, len(source_records))
    if len(score.tracks[score_track_index].bars) < start_bar + args.bar_count:
        raise ValueError("MIDI-GPT parsed fewer bars than the selected chorus range.")
    engine = InferenceEngine.from_pretrained(args.model, device=args.device)

    allowed = allowed_pitches(args.key, args.scale, args.pitch_min, args.pitch_max)
    if not allowed:
        raise ValueError("The requested key and register do not share any allowed MIDI pitches.")
    prompts = [
        TrackPrompt(id=index, bars=bar_indices if index == score_track_index else [])
        for index in range(len(score.tracks))
    ]
    config = InferenceConfig(
        model_dim=8,
        mask_mode="attention",
        temperature=args.temperature,
        top_p=0.95,
        seed=args.seed,
    )
    prompts[score_track_index] = TrackPrompt(
        id=score_track_index,
        bars=bar_indices,
        controls={"pitch_mask": {"pitches": allowed}},
    )
    result = engine.session(score, GenerationRequest(tracks=prompts, config=config)).run()
    generated = candidate_note_events(result, score_track_index, bar_indices, ticks_per_bar, set(allowed))

    if args.verify_repeatability:
        repeat = engine.session(score, GenerationRequest(tracks=prompts, config=config)).run()
        repeated = candidate_note_events(repeat, score_track_index, bar_indices, ticks_per_bar, set(allowed))
        if generated != repeated:
            raise ValueError("Same-seed repeatability check failed; candidate was not written.")
        print("Same-seed repeatability: PASS")

    output_midi = copy.deepcopy(source_midi)
    output_midi.tracks[bass_index] = splice_notes(
        source_midi.tracks[bass_index], target_start, target_end, generated, mido
    )
    verify_protected_events(source_midi, output_midi, bass_index, target_start, target_end)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_midi.save(output_path)

    # Re-read serialized output and repeat the protected-event check on the file.
    reopened = mido.MidiFile(output_path)
    verify_protected_events(source_midi, reopened, bass_index, target_start, target_end)
    actual_candidate = [r for r in note_records(absolute_events(reopened.tracks[bass_index]))
                        if target_start <= r["start"] < target_end]
    if not actual_candidate:
        output_path.unlink(missing_ok=True)
        raise ValueError("Serialized candidate has no notes in the selected bars; output removed.")

    report = {
        "input": str(source_path),
        "output": str(output_path),
        "model": args.model,
        "seed": args.seed,
        "key": args.key,
        "scale": args.scale,
        "track": args.track_name,
        "bars_one_based": [args.start_bar, args.start_bar + args.bar_count - 1],
        "pitch_range": [args.pitch_min, args.pitch_max],
        "candidate_note_count": len(actual_candidate),
        "protected_tracks_and_outside_bass_span": "verified unchanged",
        "acceptance": "audition candidate only; not a MIDI Arcade quality-gate approval",
    }
    print(json.dumps(report, indent=2))


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Source MIDI; never modified")
    parser.add_argument("--output", required=True, help="New candidate MIDI path")
    parser.add_argument("--track-name", default="02 Bass")
    parser.add_argument("--start-bar", type=int, default=3, help="One-based first bar; default is chorus 1")
    parser.add_argument("--bar-count", type=int, default=4)
    parser.add_argument("--key", default="E")
    parser.add_argument("--scale", choices=sorted(SCALE_INTERVALS), default="minor")
    parser.add_argument("--pitch-min", type=int, default=35)
    parser.add_argument("--pitch-max", type=int, default=52)
    parser.add_argument("--model", default="yellow_medium")
    parser.add_argument("--device", choices=["auto", "cpu", "cuda", "mps"], default="auto")
    parser.add_argument("--seed", type=int, default=20260924)
    parser.add_argument("--temperature", type=float, default=0.9)
    parser.add_argument("--verify-repeatability", action="store_true")
    return parser.parse_args(argv)


if __name__ == "__main__":
    try:
        run(parse_args())
    except Exception as error:  # keep a failed experiment from leaving a misleading candidate
        print(f"MIDI-GPT experiment failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
