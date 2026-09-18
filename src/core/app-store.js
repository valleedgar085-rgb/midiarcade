import { createDefaultAutoControls } from "./auto-control-policy.js";

function isObject(value) {
  return Boolean(value && typeof value === "object");
}

export function createInitialAppState() {
  return {
    song: null,
    history: [],
    future: [],
    trackSettings: {},
    muted: new Set(),
    solo: new Set(),
    locked: new Set(),
    autoControls: createDefaultAutoControls(),
    focusedSection: null,
    recipeIndex: 0,
    generationCount: 0,
    loop: false,
    isGenerating: false,
    selectedTrack: "drums",
    mixAssistant: {
      enabled: true,
      spotlightTrack: "auto",
      spotlightIntensity: 68,
    },
    activeWorkspace: "create",
    workflowStep: 1,
    guidedMode: true,
    editorTrack: "melody",
    sectionEditorOpen: false,
    editorOverlay: "partner",
    editorGrid: 0.25,
    editorZoom: 64,
    editorSelection: new Set(),
    sectionVariations: null,
    shapeDirector: {
      target: "section",
      size: "touchUp",
      direction: null,
      preserve: [],
      transaction: null,
      audition: "before",
    },
    songVariations: [],
    activeSongVariation: -1,
    sectionMacroValues: {},
    coverVariation: 0,
    tasteProfile: {
      ratings: 0,
      likes: 0,
      rejects: 0,
      favorites: 0,
      energyTotal: 0,
      complexityTotal: 0,
      variationTotal: 0,
      genreVotes: {},
      songRatings: {},
    },
    playingSection: null,
  };
}

/**
 * A deliberately small store used as the migration boundary for the studio.
 * Existing feature modules may retain a reference to the state object while
 * new work can use named transactions and subscriptions.
 */
export function createAppStore(initialState) {
  if (!isObject(initialState)) throw new TypeError("createAppStore requires an initial state object");
  const listeners = new Set();
  let revision = 0;
  let lastSubscriberError = null;

  function notify(label) {
    const event = Object.freeze({ label: String(label || "update"), revision, state: initialState });
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        lastSubscriberError = error;
      }
    }
  }

  return Object.freeze({
    getState() {
      return initialState;
    },
    getRevision() {
      return revision;
    },
    getLastSubscriberError() {
      return lastSubscriberError;
    },
    transaction(label, mutation) {
      if (typeof mutation !== "function") throw new TypeError("store transactions require a mutation function");
      const result = mutation(initialState);
      revision += 1;
      notify(label);
      return result;
    },
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("store subscribers must be functions");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
