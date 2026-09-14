export const ELEMENT_BUTTON_V3_STYLE_ID = "element-button-v3-styles";

export const ELEMENT_BUTTON_V3_CSS = `
/* Create V2: clearer direction -> generate -> choose personality hierarchy. */
#preGenSection {
  overflow:hidden;
  border-color:rgba(124,58,237,.22);
  background:
    radial-gradient(circle at 88% -8%,rgba(34,211,238,.09),transparent 32%),
    radial-gradient(circle at 8% 0%,rgba(157,111,255,.11),transparent 34%),
    linear-gradient(180deg,rgba(15,15,25,.97),rgba(7,7,12,.98));
  box-shadow:inset 0 1px rgba(255,255,255,.04),0 24px 54px rgba(0,0,0,.22);
}

#preGenSection::before {
  content:"";
  position:absolute;
  inset:0 18% auto;
  height:2px;
  background:linear-gradient(90deg,transparent,#9d6fff,#22d3ee,transparent);
  opacity:.66;
  pointer-events:none;
}

#preGenSection .creator-heading .eyebrow {
  color:#b9a3ff;
  letter-spacing:.17em;
}

#preGenSection .genre-direction,
#preGenSection .generation-intent,
#preGenSection .phase1-advanced-direction {
  backdrop-filter:blur(8px);
}

#preGenSection .generation-actions-bar {
  position:relative;
}

#preGenSection .generation-new,
#preGenSection .generation-similar {
  position:relative;
  overflow:hidden;
  transition:transform .17s ease,border-color .17s ease,box-shadow .17s ease,filter .17s ease;
}

#preGenSection .generation-new {
  border-color:rgba(167,139,250,.68);
  background:
    radial-gradient(circle at 12% 0%,rgba(196,181,253,.18),transparent 46%),
    linear-gradient(135deg,rgba(124,58,237,.3),rgba(76,29,149,.16));
  box-shadow:0 16px 38px rgba(76,29,149,.28),inset 0 1px rgba(255,255,255,.08);
}

#preGenSection .generation-similar {
  border-color:rgba(34,211,238,.22);
  background:linear-gradient(135deg,rgba(34,211,238,.075),rgba(255,255,255,.025));
}

#preGenSection .generation-new:hover,
#preGenSection .generation-similar:hover {
  transform:translateY(-2px);
  filter:brightness(1.06);
}

#preGenSection .generation-new:active,
#preGenSection .generation-similar:active {
  transform:translateY(0) scale(.99);
}

#preGenSection .generation-new strong,
#preGenSection .generation-similar strong {
  letter-spacing:-.015em;
}

#preGenSection .song-variation-tray {
  position:relative;
  overflow:hidden;
  border-color:rgba(255,255,255,.1);
  background:
    linear-gradient(90deg,rgba(255,92,52,.035),rgba(255,216,67,.035),rgba(75,184,255,.04)),
    rgba(5,5,10,.72);
  box-shadow:inset 0 1px rgba(255,255,255,.04);
}

#preGenSection .song-variation-heading strong {
  font-size:1.05rem;
}

#preGenSection .song-variation-heading small {
  color:#c4b5fd;
}

#preGenSection .song-variation-options {
  gap:10px;
}

#preGenSection .song-variation-options button {
  --element-rgb:157,111,255;
  --element-rgb-soft:157,111,255;
  position:relative;
  isolation:isolate;
  flex:1 1 0;
  min-width:0;
  min-height:94px;
  padding:16px 15px 14px;
  overflow:hidden;
  border:1px solid rgba(var(--element-rgb),.30);
  border-radius:18px;
  background:
    radial-gradient(circle at 18% 0%,rgba(var(--element-rgb-soft),.17),transparent 46%),
    linear-gradient(155deg,rgba(var(--element-rgb),.11),rgba(255,255,255,.025) 58%,rgba(0,0,0,.16));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.07),
    inset 0 -1px 0 rgba(0,0,0,.28),
    0 8px 20px rgba(0,0,0,.20);
  transform:translateY(0) scale(1);
  transition:transform .18s cubic-bezier(.2,.8,.2,1),border-color .18s ease,box-shadow .18s ease,filter .18s ease,background .18s ease;
  -webkit-tap-highlight-color:transparent;
}

#preGenSection .song-variation-options button::before {
  content:"";
  position:absolute;
  inset:0 auto 0 0;
  width:4px;
  background:linear-gradient(180deg,rgba(var(--element-rgb),1),rgba(var(--element-rgb),.18));
  box-shadow:0 0 22px rgba(var(--element-rgb),.46);
}

#preGenSection .song-variation-options button::after {
  content:"";
  position:absolute;
  width:104px;
  height:104px;
  right:-44px;
  top:-58px;
  border-radius:50%;
  background:radial-gradient(circle,rgba(var(--element-rgb-soft),.24),transparent 68%);
  opacity:.72;
  pointer-events:none;
  transition:transform .2s ease,opacity .2s ease;
}

#preGenSection .song-variation-options button:hover {
  transform:translateY(-3px);
  border-color:rgba(var(--element-rgb),.52);
  box-shadow:inset 0 1px rgba(255,255,255,.09),0 14px 30px rgba(0,0,0,.27),0 0 24px rgba(var(--element-rgb),.11);
}

#preGenSection .song-variation-options button:hover::after {
  transform:scale(1.14);
  opacity:1;
}

#preGenSection .song-variation-options button:active {
  transform:translateY(0) scale(.985);
  filter:brightness(.96);
}

#preGenSection .song-variation-options button:focus-visible {
  outline:2px solid rgba(var(--element-rgb),.96);
  outline-offset:3px;
}

#preGenSection .song-variation-options button b {
  display:block;
  position:relative;
  z-index:1;
  font-family:var(--font-display);
  font-size:clamp(1rem,1.55vw,1.2rem);
  line-height:1;
  text-transform:uppercase;
  color:rgb(var(--element-rgb));
}

#preGenSection .song-variation-options button small {
  display:block;
  position:relative;
  z-index:1;
  margin-top:10px;
  max-width:24ch;
  color:rgba(244,244,252,.76);
  font:700 .6rem/1.42 var(--font-data);
  letter-spacing:.045em;
}

#preGenSection .song-variation-options button[data-element="fire"],
#preGenSection .song-variation-options button:nth-child(1) {
  --element-rgb:255,105,58;
  --element-rgb-soft:255,157,74;
  background:radial-gradient(circle at 18% 0%,rgba(255,154,72,.25),transparent 48%),linear-gradient(150deg,rgba(255,72,35,.15),rgba(90,22,10,.05) 60%,rgba(0,0,0,.18));
}

#preGenSection .song-variation-options button[data-element="fire"] b,
#preGenSection .song-variation-options button:nth-child(1) b {
  font-weight:900;
  letter-spacing:.115em;
  text-shadow:0 0 18px rgba(255,96,48,.30);
}

#preGenSection .song-variation-options button[data-element="electric"],
#preGenSection .song-variation-options button:nth-child(2) {
  --element-rgb:255,216,67;
  --element-rgb-soft:255,239,143;
  background:linear-gradient(118deg,rgba(255,228,88,.19),rgba(255,183,34,.10) 54%,rgba(255,245,170,.06)),linear-gradient(155deg,rgba(255,214,56,.08),rgba(0,0,0,.18));
}

#preGenSection .song-variation-options button[data-element="electric"]::before,
#preGenSection .song-variation-options button:nth-child(2)::before {
  background:linear-gradient(180deg,#fff6a1 0%,#ffd43b 42%,#ffae22 100%);
  box-shadow:0 0 24px rgba(255,210,50,.56);
}

#preGenSection .song-variation-options button[data-element="electric"] b,
#preGenSection .song-variation-options button:nth-child(2) b {
  color:#ffdc43;
  font-weight:880;
  font-style:italic;
  letter-spacing:.07em;
  transform:skewX(-6deg);
  transform-origin:left center;
  text-shadow:0 0 20px rgba(255,211,58,.34);
}

#preGenSection .song-variation-options button[data-element="drip"],
#preGenSection .song-variation-options button:nth-child(3) {
  --element-rgb:75,184,255;
  --element-rgb-soft:111,222,255;
  background:radial-gradient(ellipse at 88% 110%,rgba(61,153,255,.23),transparent 54%),linear-gradient(150deg,rgba(43,105,255,.09),rgba(42,211,255,.07) 58%,rgba(0,0,0,.17));
}

#preGenSection .song-variation-options button[data-element="drip"] b,
#preGenSection .song-variation-options button:nth-child(3) b {
  font-weight:670;
  letter-spacing:.18em;
  text-shadow:0 0 20px rgba(81,188,255,.30);
}

#preGenSection .song-variation-options button.is-active {
  transform:translateY(-3px) scale(1.012);
  outline:none;
  border-color:rgba(var(--element-rgb),.84);
  box-shadow:inset 0 1px rgba(255,255,255,.12),0 16px 34px rgba(0,0,0,.30),0 0 0 1px rgba(var(--element-rgb),.22),0 0 34px rgba(var(--element-rgb),.18);
}

#preGenSection .song-variation-options button.is-active::after {
  transform:scale(1.2);
  opacity:1;
}

#preGenSection .song-variation-options button.is-active small {
  color:#fff;
}

@media (max-width:600px) {
  #preGenSection .generation-new,
  #preGenSection .generation-similar {min-height:78px}
  #preGenSection .song-variation-options {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
  #preGenSection .song-variation-options button {min-height:92px;padding:12px 9px;border-radius:15px}
  #preGenSection .song-variation-options button b {font-size:.84rem;letter-spacing:.04em}
  #preGenSection .song-variation-options button small {font-size:.52rem;line-height:1.3;letter-spacing:0}
}

@media (prefers-reduced-motion:reduce) {
  #preGenSection .generation-new,
  #preGenSection .generation-similar,
  #preGenSection .song-variation-options button,
  #preGenSection .song-variation-options button::after {transition:none}
}
`;

export function applyElementButtonV3(rootDocument = globalThis.document) {
  if (!rootDocument?.head || typeof rootDocument.createElement !== "function") return false;
  if (rootDocument.getElementById?.(ELEMENT_BUTTON_V3_STYLE_ID)) return false;
  const style = rootDocument.createElement("style");
  style.id = ELEMENT_BUTTON_V3_STYLE_ID;
  style.textContent = ELEMENT_BUTTON_V3_CSS;
  rootDocument.head.append(style);
  return true;
}

if (typeof document !== "undefined") applyElementButtonV3(document);
