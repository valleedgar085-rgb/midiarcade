import unittest
from types import SimpleNamespace

from regenerate_bass import (
    allowed_pitches,
    canonical_records,
    note_records,
    splice_notes,
    verify_protected_events,
)


class Message:
    def __init__(self, type, **kwargs):
        self.type = type
        self.time = kwargs.pop("time", 0)
        for key, value in kwargs.items():
            setattr(self, key, value)

    def copy(self):
        return Message(self.type, **{k: v for k, v in vars(self).items() if k != "type"})

    def dict(self):
        return {"type": self.type, **{k: v for k, v in vars(self).items() if k != "type"}}


class MidiTrack(list):
    pass


class BassInfillContractTests(unittest.TestCase):
    def test_e_minor_pitch_allow_set_stays_inside_requested_register(self):
        self.assertEqual(
            allowed_pitches("E", "minor", 35, 52),
            [35, 36, 38, 40, 42, 43, 45, 47, 48, 50, 52],
        )

    def test_splice_replaces_only_requested_bass_notes_and_preserves_source(self):
        source_bass = MidiTrack([
            Message("track_name", name="02 Bass"),
            Message("note_on", channel=0, note=40, velocity=80, time=100),
            Message("note_off", channel=0, note=40, velocity=0, time=300),
            Message("note_on", channel=0, note=43, velocity=70, time=1820),
            Message("note_off", channel=0, note=43, velocity=0, time=300),
            Message("note_on", channel=0, note=45, velocity=75, time=3480),
            Message("note_off", channel=0, note=45, velocity=0, time=240),
            Message("end_of_track", time=2000),
        ])
        protected_drums = MidiTrack([
            Message("track_name", name="01 Drums"),
            Message("note_on", channel=9, note=36, velocity=100, time=0),
            Message("note_off", channel=9, note=36, velocity=0, time=120),
            Message("end_of_track", time=5000),
        ])
        source = SimpleNamespace(tracks=[protected_drums, source_bass])
        before_outside = [r for r in note_records(
            [(tick, order, msg.copy()) for tick, order, msg in _absolute(source_bass)]
        ) if not 1920 <= r["start"] < 5760]
        drums_snapshot = [m.dict() for m in protected_drums]

        candidate_bass = splice_notes(
            source_bass,
            target_start=1920,
            target_end=5760,
            generated=[(2200, 40, 88, 240)],
            midi=SimpleNamespace(Message=Message, MidiTrack=MidiTrack),
        )
        result = SimpleNamespace(tracks=[protected_drums, candidate_bass])
        verify_protected_events(source, result, 1, 1920, 5760)

        after = _absolute(candidate_bass)
        after_records = note_records(after)
        after_outside = [r for r in after_records if not 1920 <= r["start"] < 5760]
        self.assertEqual(canonical_records(before_outside), canonical_records(after_outside))
        self.assertEqual([m.dict() for m in protected_drums], drums_snapshot)
        self.assertEqual(
            [(r["start"], r["end"], r["pitch"]) for r in after_records if 1920 <= r["start"] < 5760],
            [(2200, 2440, 40)],
        )
        self.assertEqual(source_bass[1].note, 40, "the source track must remain untouched")


def _absolute(track):
    tick = 0
    result = []
    for order, message in enumerate(track):
        tick += message.time
        result.append((tick, order, message.copy()))
    return result


if __name__ == "__main__":
    unittest.main()
