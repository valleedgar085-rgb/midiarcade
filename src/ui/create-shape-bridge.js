import {
  creativeContextChips,
  creativeContextSignature,
  normalizeCreativeContext,
} from "../core/creative-context.js";

let activeCreativeContext = null;

function text(root, selector, fallback = "") {
  return root.querySelector?.(selector)?.textContent?.replace(/\s+/g, " ").trim() || fallback;
}

function controlValue(root, selector, fallback = "") {
  const control = root.querySelector?.(selector);
  return control?.value ?? fallback;
}

function selectedElementId(root) {
  const selected = [...(root.querySelectorAll?.("[data-song-variation]") ?? [])].find((button) => (
    button.getAttribute?.("aria-checked") === "true"
    || button.classList?.contains?.("is-active")
    || button.classList?.contains?.("is-selected")
  ));
  if (!selected) return null;
  const index = String(selected.dataset?.songVariation ?? "");
  if (index === "0") return "fire";
  if (index === "1") return "electric";
  if (index === "2") return "drip";
  return selected.textContent ?? null;
}

export function readCreateCreativeContext(root = document) {
  return normalizeCreativeContext({
    song: {
      title: text(root, "#songTitle", "Current idea"),
      genre: text(root, "#factGenre", "AUTO STYLE"),
      keyMode: text(root, "#factKey", "AUTO KEY"),
      tempo: text(root, "#factTempo", "AUTO BPM"),
      bars: text(root, "#factBars", "AUTO LENGTH"),
      groove: text(root, "#factRhythm", "AUTO POCKET"),
      dnaFingerprint: text(root, "#dnaFingerprint", "--"),
      dnaScore: text(root, "#dnaScoreBadge", "--"),
    },
    direction: {
      status: text(root, "#generationIntentLabel", "CURRENT SONG"),
      genreId: controlValue(root, "#genreControl", "auto"),
      secondaryGenreId: controlValue(root, "#secondaryGenreControl", "none"),
      key: controlValue(root, "#keyControl", "auto"),
      mode: controlValue(root, "#modeControl", "auto"),
      tempo: controlValue(root, "#tempoControl", null),
      bars: controlValue(root, "#barsControl", "auto"),
      groove: controlValue(root, "#grooveControl", "auto"),
      energy: controlValue(root, "#energyControl", null),
      complexity: controlValue(root, "#complexityControl", null),
      variation: controlValue(root, "#variationControl", null),
      evolution: controlValue(root, "#evolutionControl", null),
      surprise: controlValue(root, "#surpriseControl", null),
    },
    element: selectedElementId(root),
  });
}

export function hasGeneratedCreateSong(root = document) {
  const seed = text(root, "#seedLabel", "");
  const fingerprint = text(root, "#dnaFingerprint", "");
  return Boolean(
    (seed && !seed.includes("--"))
    || (fingerprint && fingerprint !== "00·00·00" && fingerprint !== "--")
  );
}

function ensureStyles(root) {
  const doc = root.ownerDocument ?? root;
  if (doc.getElementById?.("createShapeBridgeStyles")) return;
  const style = doc.createElement("style");
  style.id = "createShapeBridgeStyles";
  style.textContent = `
    .create-shape-handoff{margin-top:14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:16px 18px;border:1px solid rgba(124,92,255,.32);border-radius:18px;background:linear-gradient(135deg,rgba(124,92,255,.13),rgba(34,211,238,.06));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
    .create-shape-handoff-copy{display:flex;flex-direction:column;gap:3px;min-width:0}.create-shape-handoff-copy small,.shape-dna-ribbon-heading small{font:700 10px/1.2 var(--font-mono,monospace);letter-spacing:.13em;color:var(--muted,#9ca3af)}
    .create-shape-handoff-copy strong{font-size:15px}.create-shape-handoff-copy span{font-size:12px;color:var(--muted,#9ca3af)}
    .create-shape-handoff button,.shape-dna-ribbon button{border:0;border-radius:12px;min-height:44px;padding:0 16px;font:800 12px/1 var(--font-body,system-ui);cursor:pointer}
    .create-shape-handoff button{background:linear-gradient(135deg,#8b5cf6,#22d3ee);color:#08080b;box-shadow:0 8px 30px rgba(34,211,238,.13)}.create-shape-handoff button:disabled{opacity:.45;cursor:not-allowed;filter:saturate(.45)}
    .shape-dna-ribbon{margin:0 0 14px;padding:14px 16px;border:1px solid rgba(124,92,255,.3);border-radius:18px;background:linear-gradient(145deg,rgba(124,92,255,.12),rgba(8,8,11,.9));display:grid;gap:10px}
    .shape-dna-ribbon-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.shape-dna-ribbon-heading{display:flex;flex-direction:column;gap:3px}.shape-dna-ribbon-heading strong{font-size:16px}.shape-dna-ribbon-heading span{font-size:12px;color:var(--muted,#9ca3af)}
    .shape-dna-ribbon button{background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.09)}
    .shape-dna-chips{display:flex;gap:7px;flex-wrap:wrap}.shape-dna-chip{padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07);font:700 10px/1 var(--font-mono,monospace);letter-spacing:.035em}.shape-dna-chip.is-element{border-color:rgba(251,191,36,.28)}
    .shape-dna-ribbon-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--muted,#9ca3af)}
    @media(max-width:700px){.create-shape-handoff{grid-template-columns:1fr}.create-shape-handoff button{width:100%}.shape-dna-ribbon-top{flex-direction:column}.shape-dna-ribbon button{width:100%}}
  `;
  doc.head?.appendChild(style);
}

function createHandoffCard(root) {
  const doc = root.ownerDocument ?? root;
  if (root.querySelector?.("#shapeThisSongButton")) return root.querySelector("#shapeThisSongButton");
  const host = root.querySelector?.("#preGenSection");
  if (!host) return null;
  const card = doc.createElement("section");
  card.className = "create-shape-handoff";
  card.id = "createShapeHandoff";
  card.setAttribute("aria-label", "Continue to Shape");
  card.innerHTML = `
    <div class="create-shape-handoff-copy">
      <small>CONTINUE THE SAME SONG</small>
      <strong>Ready to shape this idea?</strong>
      <span>Carry the current song DNA into Shape instead of starting over.</span>
    </div>
    <button id="shapeThisSongButton" type="button" data-create-control="shape-this-song" data-create-intent="navigation" data-create-event="click" aria-description="Carry the current generated song DNA into Shape.">Shape this song →</button>
  `;
  host.appendChild(card);
  return card.querySelector("#shapeThisSongButton");
}

function createShapeRibbon(root) {
  const doc = root.ownerDocument ?? root;
  const existing = root.querySelector?.("#createShapeContextRibbon");
  if (existing) return existing;
  const panel = root.querySelector?.("#tab-arrange");
  const thread = root.querySelector?.("#creativeThread");
  if (!panel || !thread) return null;
  const ribbon = doc.createElement("section");
  ribbon.className = "shape-dna-ribbon";
  ribbon.id = "createShapeContextRibbon";
  ribbon.setAttribute("aria-label", "Inherited song DNA from Create");
  ribbon.innerHTML = `
    <div class="shape-dna-ribbon-top">
      <div class="shape-dna-ribbon-heading">
        <small>FROM CREATE · SONG DNA</small>
        <strong id="shapeDnaTitle">Current idea</strong>
        <span id="shapeDnaCopy">Shape local decisions while the song identity stays connected.</span>
      </div>
      <button id="shapeBackToCreate" type="button">Edit direction</button>
    </div>
    <div class="shape-dna-chips" id="shapeDnaChips"></div>
    <div class="shape-dna-ribbon-meta"><span id="shapeDnaFingerprint">DNA --</span><span id="shapeDnaDirectionState">CURRENT SONG</span></div>
  `;
  panel.insertBefore(ribbon, thread);
  return ribbon;
}

export function renderShapeCreativeContext(root = document, context = activeCreativeContext) {
  if (!context) return null;
  const normalized = normalizeCreativeContext(context);
  const ribbon = createShapeRibbon(root);
  if (!ribbon) return null;
  const setText = (selector, value) => {
    const node = ribbon.querySelector(selector);
    if (node) node.textContent = value;
  };
  setText("#shapeDnaTitle", normalized.song.title);
  setText("#shapeDnaFingerprint", `DNA ${normalized.song.dnaFingerprint} · ${normalized.song.dnaScore}`);
  setText("#shapeDnaDirectionState", normalized.direction.status);
  setText(
    "#shapeDnaCopy",
    normalized.element
      ? `${normalized.element.glyph} ${normalized.element.label} is the active production personality. Shape changes stay local to this song.`
      : "Shape local decisions while the current song identity stays connected."
  );
  const chips = ribbon.querySelector("#shapeDnaChips");
  if (chips) {
    chips.replaceChildren(...creativeContextChips(normalized).map((label, index, list) => {
      const chip = (root.ownerDocument ?? root).createElement("span");
      chip.className = `shape-dna-chip${normalized.element && index === list.length - 1 ? " is-element" : ""}`;
      chip.textContent = label;
      return chip;
    }));
  }
  ribbon.dataset.contextSignature = creativeContextSignature(normalized);
  return ribbon;
}

function emitContext(root, context) {
  const doc = root.ownerDocument ?? root;
  const view = doc.defaultView;
  const CustomEventCtor = view?.CustomEvent ?? globalThis.CustomEvent;
  if (typeof CustomEventCtor !== "function") return;
  doc.dispatchEvent(new CustomEventCtor("midiarcade:create-shape-context", { detail: context }));
}

function updateHandoffAvailability(root, button) {
  if (!button) return;
  const ready = hasGeneratedCreateSong(root);
  button.disabled = !ready;
  button.setAttribute("aria-disabled", String(!ready));
  button.title = ready ? "Carry this song into Shape" : "Generate a song before shaping it";
}

export function getActiveCreativeContext() {
  return activeCreativeContext;
}

export function installCreateShapeBridge(root = document) {
  const doc = root.ownerDocument ?? root;
  if (!doc?.documentElement || doc.documentElement.dataset.createShapeBridge === "installed") return;
  doc.documentElement.dataset.createShapeBridge = "installed";
  ensureStyles(doc);
  const handoffButton = createHandoffCard(doc);
  createShapeRibbon(doc)?.setAttribute("hidden", "");
  updateHandoffAvailability(doc, handoffButton);

  handoffButton?.addEventListener("click", () => {
    activeCreativeContext = readCreateCreativeContext(doc);
    const ribbon = renderShapeCreativeContext(doc, activeCreativeContext);
    ribbon?.removeAttribute("hidden");
    emitContext(doc, activeCreativeContext);
    doc.querySelector?.('[data-workspace="arrange"]')?.click?.();
  });

  doc.querySelector?.("#shapeBackToCreate")?.addEventListener("click", () => {
    doc.querySelector?.('[data-workspace="create"]')?.click?.();
  });

  doc.querySelector?.('[data-workspace="arrange"]')?.addEventListener("click", () => {
    if (hasGeneratedCreateSong(doc)) activeCreativeContext = readCreateCreativeContext(doc);
    if (activeCreativeContext) {
      const ribbon = renderShapeCreativeContext(doc, activeCreativeContext);
      ribbon?.removeAttribute("hidden");
      emitContext(doc, activeCreativeContext);
    }
  });

  const readinessTargets = [doc.querySelector?.("#seedLabel"), doc.querySelector?.("#dnaFingerprint")].filter(Boolean);
  if (typeof MutationObserver !== "undefined" && readinessTargets.length) {
    const observer = new MutationObserver(() => updateHandoffAvailability(doc, handoffButton));
    readinessTargets.forEach((node) => observer.observe(node, { childList: true, characterData: true, subtree: true }));
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => installCreateShapeBridge(document), { once: true });
  } else {
    installCreateShapeBridge(document);
  }
}
