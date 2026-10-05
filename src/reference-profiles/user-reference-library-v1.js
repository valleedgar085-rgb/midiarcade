// Derived from the user's uploaded reference.zip.
// Metadata/statistics only: no source audio, melodies, chord progressions, or note sequences are stored.
export const USER_REFERENCE_PROFILES_V1 = Object.freeze({
  "hipHop": {
    "version": 1,
    "id": "user-reference-hipHop-v1",
    "genre": "hipHop",
    "sourceCount": 6,
    "confidence": 0.926,
    "traits": {
      "syncopation": 0.531,
      "swing": 0.136,
      "humanize": 0.25,
      "phraseBars": 4,
      "density": 0.43,
      "bassActivity": 0.88,
      "bassLock": 0.88,
      "melodySpace": 0.57,
      "supportRestraint": 0.348,
      "introRestraint": 0.164,
      "payoffLift": 0.568,
      "transitionBreath": 0.317
    },
    "analysis": {
      "tempoMedianBpm": 85.2,
      "tempoIqrBpm": [
        82.4,
        109.2
      ],
      "collection": "reference.zip",
      "extraction": "audio-statistics-v1"
    },
    "stylePreferences": {
      "drumGroove": {
        "backbeat": 0.95,
        "breakbeat": 0.5,
        "halfTime": 0.42,
        "electro": 0.18
      },
      "bassGroove": {
        "syncopated": 0.84,
        "rootFifth": 0.74,
        "pulse": 0.32,
        "walking": 0.18
      },
      "chordMotion": {
        "sustained": 0.9,
        "offbeat": 0.52,
        "pulse": 0.3,
        "arpeggio": 0.24
      }
    }
  },
  "pop": {
    "version": 1,
    "id": "user-reference-pop-v1",
    "genre": "pop",
    "sourceCount": 6,
    "confidence": 0.93,
    "traits": {
      "syncopation": 0.334,
      "swing": 0.062,
      "humanize": 0.124,
      "phraseBars": 4,
      "density": 0.675,
      "bassActivity": 0.88,
      "bassLock": 0.88,
      "melodySpace": 0.325,
      "supportRestraint": 0.273,
      "introRestraint": 0.594,
      "payoffLift": 0.88,
      "transitionBreath": 0.188
    },
    "analysis": {
      "tempoMedianBpm": 113.7,
      "tempoIqrBpm": [
        110.3,
        129.7
      ],
      "collection": "reference.zip",
      "extraction": "audio-statistics-v1"
    },
    "stylePreferences": {
      "drumGroove": {
        "backbeat": 0.84,
        "fourFloor": 0.5,
        "electro": 0.42,
        "breakbeat": 0.28
      },
      "bassGroove": {
        "rootFifth": 0.68,
        "pulse": 0.62,
        "syncopated": 0.56,
        "walking": 0.14
      },
      "chordMotion": {
        "sustained": 0.66,
        "offbeat": 0.62,
        "pulse": 0.58,
        "arpeggio": 0.38
      }
    }
  },
  "rap": {
    "version": 1,
    "id": "user-reference-rap-v1",
    "genre": "rap",
    "sourceCount": 4,
    "confidence": 0.896,
    "traits": {
      "syncopation": 0.547,
      "swing": 0.116,
      "humanize": 0.215,
      "phraseBars": 4,
      "density": 0.562,
      "bassActivity": 0.12,
      "bassLock": 0.88,
      "melodySpace": 0.438,
      "supportRestraint": 0.209,
      "introRestraint": 0.487,
      "payoffLift": 0.686,
      "transitionBreath": 0.12
    },
    "analysis": {
      "tempoMedianBpm": 119.1,
      "tempoIqrBpm": [
        110.2,
        122
      ],
      "collection": "reference.zip",
      "extraction": "audio-statistics-v1"
    },
    "stylePreferences": {
      "drumGroove": {
        "backbeat": 0.96,
        "breakbeat": 0.62,
        "halfTime": 0.3,
        "electro": 0.12
      },
      "bassGroove": {
        "rootFifth": 0.82,
        "syncopated": 0.7,
        "walking": 0.26,
        "pulse": 0.24
      },
      "chordMotion": {
        "sustained": 0.92,
        "offbeat": 0.38,
        "pulse": 0.26,
        "arpeggio": 0.2
      }
    }
  },
  "trap": {
    "version": 1,
    "id": "user-reference-trap-v1",
    "genre": "trap",
    "sourceCount": 12,
    "confidence": 0.96,
    "traits": {
      "syncopation": 0.559,
      "swing": 0.086,
      "humanize": 0.181,
      "phraseBars": 4,
      "density": 0.663,
      "bassActivity": 0.88,
      "bassLock": 0.748,
      "melodySpace": 0.337,
      "supportRestraint": 0.549,
      "introRestraint": 0.88,
      "payoffLift": 0.88,
      "transitionBreath": 0.419
    },
    "analysis": {
      "tempoMedianBpm": 98.7,
      "tempoIqrBpm": [
        98.7,
        127.2
      ],
      "collection": "reference.zip",
      "extraction": "audio-statistics-v1"
    },
    "stylePreferences": {
      "drumGroove": {
        "halfTime": 0.96,
        "backbeat": 0.32,
        "electro": 0.24,
        "breakbeat": 0.12
      },
      "bassGroove": {
        "syncopated": 0.95,
        "rootFifth": 0.46,
        "pulse": 0.38
      },
      "chordMotion": {
        "sustained": 0.9,
        "arpeggio": 0.48,
        "pulse": 0.34,
        "offbeat": 0.26
      }
    }
  }
});
