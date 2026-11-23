import { normalizePreviewQuality } from "../core/preview-performance.js";

export function previewQualityStatus(preference, active, playing) {
  const quality = normalizePreviewQuality(preference);
  if (quality !== normalizePreviewQuality(active)) return playing
    ? "Pause, then press Play to apply. MIDI stays unchanged."
    : "Press Play to apply. MIDI stays unchanged.";
  return quality === "studio"
    ? "Stereo space and richer layers. Uses more battery; choose Auto if it crackles. MIDI is unchanged."
    : "Device-friendly sound. Studio adds richer effects; MIDI is unchanged.";
}

export function renderPreviewQualityControls(container, { preference, active, playing } = {}) {
  if (!container) return;
  if (!container.querySelector("[data-preview-quality]")) {
    container.innerHTML = `<label class="preview-quality-field"><span><small>ON THIS DEVICE</small><strong>Preview sound</strong></span><select data-preview-quality aria-label="Preview sound quality" aria-describedby="previewQualityStatus"><option value="auto">Auto · stable</option><option value="studio">Studio · richer</option></select></label><p id="previewQualityStatus" role="status" aria-live="polite"></p>`;
  }
  const select = container.querySelector("[data-preview-quality]");
  if (select) select.value = normalizePreviewQuality(preference);
  const status = container.querySelector("#previewQualityStatus");
  if (status) status.textContent = previewQualityStatus(preference, active, playing);
}
