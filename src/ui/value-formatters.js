export function formatLevel(value) {
  const gain = Math.min(1, Math.max(0, Number(value) || 0));
  if (gain <= 0.0001) return "−∞ dB · muted";
  const decibels = 20 * Math.log10(gain);
  const label = Math.abs(decibels) < 0.05 ? "0.0" : decibels.toFixed(1);
  return `${label} dB · ${Math.round(gain * 100)}%`;
}

export function formatVelocityScale(value) {
  const scale = Math.min(1.5, Math.max(0.5, Number(value) || 1));
  return `×${scale.toFixed(2)} · MIDI 1–127`;
}

export function formatGate(value) {
  const scale = Math.min(1.5, Math.max(0.25, Number(value) || 1));
  const feel = scale < 0.8 ? "short" : scale > 1.08 ? "connected" : "natural";
  return `${Math.round(scale * 100)}% · ${feel}`;
}

export function formatMidiVelocity(value) {
  const velocity = Math.min(127, Math.max(1, Math.round(Number(value) || 1)));
  const feel = velocity <= 40 ? "soft" : velocity <= 90 ? "balanced" : "strong";
  return `${velocity} · ${feel}`;
}
