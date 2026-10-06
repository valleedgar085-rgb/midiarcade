import assert from "node:assert/strict";
import test from "node:test";

import {
  MELODY_DIRECTOR_AUTHORITY_ORDER,
  MELODY_DIRECTOR_AUTHORITY_VERSION,
  melodyDirectorAuthoritySnapshot,
  melodyDirectorSectionOwnership,
  resolveMelodyDirectorPhraseNeed,
} from "../src/core/melody-director-authority.js";

function report({
  placement = 0.9,
  conversation = 0.9,
  arc = 0.9,
} = {}) {
  return {
    score: 80,
    weakestSection: {
      sectionId: "verse-1",
      score: 70,
      metrics: {},
    },
    weakestPlacementSection: {
      sectionId: "verse-1",
      metrics: { phrasePlacement: placement },
    },
    weakestConversationSection: {
      sectionId: "verse-2",
      metrics: { phraseConversation: conversation },
    },
    weakestArcSection: {
      sectionId: "chorus-1",
      metrics: { melodicArcPayoff: arc },
    },
  };
}

test("5I publishes one deterministic Melody Director authority order", () => {
  assert.equal(MELODY_DIRECTOR_AUTHORITY_VERSION, 1);
  assert.deepEqual(
    MELODY_DIRECTOR_AUTHORITY_ORDER.map((entry) => entry.id),
    [
      "5d-phrase-placement",
      "5e-phrase-conversation",
      "5f-local-melodic-arc",
      "5g-motif-recall",
      "5h-section-story-payoff",
      "final-memory-audit",
    ],
  );
  assert.equal(
    new Set(MELODY_DIRECTOR_AUTHORITY_ORDER.map((entry) => entry.responsibility)).size,
    MELODY_DIRECTOR_AUTHORITY_ORDER.length,
    "5I responsibilities must not overlap",
  );
});

test("5I resolves phrase repairs in 5D -> 5E -> 5F order", () => {
  assert.equal(
    resolveMelodyDirectorPhraseNeed(report({
      placement: 0.5,
      conversation: 0.4,
      arc: 0.4,
    })).authorityId,
    "5d-phrase-placement",
  );
  assert.equal(
    resolveMelodyDirectorPhraseNeed(report({
      placement: 0.9,
      conversation: 0.4,
      arc: 0.4,
    })).authorityId,
    "5e-phrase-conversation",
  );
  assert.equal(
    resolveMelodyDirectorPhraseNeed(report({
      placement: 0.9,
      conversation: 0.9,
      arc: 0.4,
    })).authorityId,
    "5f-local-melodic-arc",
  );
});

test("5H owns a recalled chorus payoff so 5F cannot double-author it", () => {
  const song = {
    structure: [
      { id: "verse-1", name: "verse" },
      { id: "chorus-1", name: "chorus" },
    ],
    phraseMemory: {
      sections: [
        {
          sectionId: "chorus-1",
          sourceSectionId: "verse-1",
          relationship: "return",
        },
      ],
    },
  };
  const chorus = melodyDirectorSectionOwnership(song, "chorus-1");
  const verse = melodyDirectorSectionOwnership(song, "verse-1");

  assert.equal(chorus.sectionStoryOwnsPayoff, true);
  assert.equal(chorus.localArcOwner, "5H");
  assert.equal(chorus.sectionStoryOwner, "5H");
  assert.equal(verse.sectionStoryOwnsPayoff, false);
  assert.equal(verse.localArcOwner, "5F");
});

test("5I authority snapshot is deterministic and read-only", () => {
  const song = {
    structure: [
      { id: "verse-1", name: "verse" },
      { id: "chorus-1", name: "chorus" },
    ],
    phraseMemory: {
      sections: [
        {
          sectionId: "chorus-1",
          sourceSectionId: "verse-1",
          relationship: "return",
        },
      ],
    },
  };
  const before = structuredClone(song);
  const first = melodyDirectorAuthoritySnapshot(song, report({ placement: 0.5 }));
  const second = melodyDirectorAuthoritySnapshot(song, report({ placement: 0.5 }));

  assert.deepEqual(song, before);
  assert.deepEqual(first, second);
  assert.equal(first.phraseNeed.authorityId, "5d-phrase-placement");
  assert.equal(
    first.sectionOwnership.find((entry) => entry.sectionId === "chorus-1").localArcOwner,
    "5H",
  );
});
