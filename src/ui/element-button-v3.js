export const ELEMENT_BUTTON_V3_STYLE_ID = "element-button-v3-styles";

export const ELEMENT_BUTTON_V3_CSS = `
#preGenSection .song-variation-options {
  gap: 10px;
}

#preGenSection .song-variation-options button {
  --element-rgb:157,111,255;
  --element-rgb-soft:157,111,255;
  position:relative;
  isolation:isolate;
  min-height:88px;
  padding:15px 15px 13px;
  overflow:hidden;
  border:1px solid rgba(var(--element-rgb),.30);
  border-radius:17px;
  background:
    radial-gradient(circle at 18% 0%, rgba(var(--element-rgb-soft),.16), transparent 46%),
    linear-gradient(155deg, rgba(var(--element-rgb),.10), rgba(255,255,255,.025) 58%, rgba(0,0,0,.16));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.07),
    inset 0 -1px 0 rgba(0,0,0,.28),
    0 8px 20px rgba(0,0,0,.20);
  transform:translateY(0) scale(1);
  transition:
    transform .18s cubic-bezier(.2,.8,.2,1),
    border-color .18s ease,
    box-shadow .18s ease,
    filter .18s ease,
    background .18s ease;
  -webkit-tap-highlight-color:transparent;
}

#preGenSection .song-variation-options button::before {
  content:"";
  position:absolute;
  inset:0 auto 0 0;
  width:4px;
  background:linear-gradient(180deg, rgba(var(--element-rgb),1), rgba(var(--element-rgb),.18));
  box-shadow:0 0 22px rgba(var(--element-rgb),.46);
}

#preGenSection .song-variation-options button::after {
  content:"";
  position:absolute;
  width:94px;
  height:94px;
  right:-42px;
  top:-54px;
  border-radius:50%;
  background:radial-gradient(circle, rgba(var(--element-rgb-soft),.22), transparent 68%);
  opacity:.7;
  pointer-events:none;
  transition:transform .2s ease, opacity .2s ease;
}

#preGenSection .song-variation-options button:hover {
  transform:translateY(-3px);
  border-color:rgba(var(--element-rgb),.50);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.09),
    0 14px 30px rgba(0,0,0,.27),
    0 0 24px rgba(var(--element-rgb),.10);
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
  font-size:clamp(1rem,1.55vw,1.16rem);
  line-height:1;
  text-transform:uppercase;
  color:rgb(var(--element-rgb));
}

#preGenSection .song-variation-options button small {
  display:block;
  position:relative;
  z-index:1;
  margin-top:9px;
  max-width:22ch;
  color:rgba(244,244,252,.72);
  font:700 .59rem/1.42 var(--font-data);
  letter-spacing:.045em;
}

#preGenSection .song-variation-options button[data-element="fire"] {
  --element-rgb:255,105,58;
  --element-rgb-soft:255,157,74;
  background:
    radial-gradient(circle at 18% 0%, rgba(255,154,72,.24), transparent 48%),
    linear-gradient(150deg, rgba(255,72,35,.14), rgba(90,22,10,.05) 60%, rgba(0,0,0,.18));
}

#preGenSection .song-variation-options button[data-element="fire"] b {
  font-weight:900;
  letter-spacing:.115em;
  text-shadow:0 0 18px rgba(255,96,48,.30);
}

#preGenSection .song-variation-options button[data-element="electric"] {
  --element-rgb:255,216,67;
  --element-rgb-soft:255,239,143;
  background:
    linear-gradient(118deg, rgba(255,228,88,.18), rgba(255,183,34,.10) 54%, rgba(255,245,170,.06)),
    linear-gradient(155deg, rgba(255,214,56,.08), rgba(0,0,0,.18));
}

#preGenSection .song-variation-options button[data-element="electric"]::before {
  background:linear-gradient(180deg, #fff6a1 0%, #ffd43b 42%, #ffae22 100%);
  box-shadow:0 0 24px rgba(255,210,50,.56);
}

#preGenSection .song-variation-options button[data-element="electric"] b {
  color:#ffdc43;
  font-weight:880;
  font-style:italic;
  letter-spacing:.07em;
  transform:skewX(-6deg);
  transform-origin:left center;
  text-shadow:0 0 20px rgba(255,211,58,.34);
}

#preGenSection .song-variation-options button[data-element="drip"] {
  --element-rgb:75,184,255;
  --element-rgb-soft:111,222,255;
  background:
    radial-gradient(ellipse at 88% 110%, rgba(61,153,255,.23), transparent 54%),
    linear-gradient(150deg, rgba(43,105,255,.09), rgba(42,211,255,.07) 58%, rgba(0,0,0,.17));
}

#preGenSection .song-variation-options button[data-element="drip"] b {
  font-weight:670;
  letter-spacing:.18em;
  text-shadow:0 0 20px rgba(81,188,255,.30);
}

#preGenSection .song-variation-options button.is-active {
  transform:translateY(-3px) scale(1.012);
  outline:none;
  border-color:rgba(var(--element-rgb),.82);
  background:
    radial-gradient(circle at 18% 0%, rgba(var(--element-rgb-soft),.24), transparent 48%),
    linear-gradient(155deg, rgba(var(--element-rgb),.16), rgba(255,255,255,.035) 56%, rgba(0,0,0,.18));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.12),
    0 16px 34px rgba(0,0,0,.30),
    0 0 0 1px rgba(var(--element-rgb),.20),
    0 0 30px rgba(var(--element-rgb),.16);
}

#preGenSection .song-variation-options button.is-active small {
  color:rgba(255,255,255,.88);
}

@media (max-width:600px) {
  #preGenSection .song-variation-options {gap:9px}
  #preGenSection .song-variation-options button {
    flex-basis:164px;
    min-height:80px;
    padding:13px 13px 12px;
    border-radius:16px;
  }
  #preGenSection .song-variation-options button b {font-size:.96rem}
}

@media (prefers-reduced-motion:reduce) {
  #preGenSection .song-variation-options button,
  #preGenSection .song-variation-options button::after {
    transition:none;
  }
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
