export const MANUAL_GENERATION_CONTROL_IDS = Object.freeze({
  variation: "variationControl",
  evolution: "evolutionControl",
  surprise: "surpriseControl",
});

export function captureManualGenerationControls(autoControls, values) {
  return Object.fromEntries(Object.entries(MANUAL_GENERATION_CONTROL_IDS)
    .filter(([key, id]) => !autoControls.has(id) && Number.isFinite(values[key]))
    .map(([key]) => [key, values[key]]));
}

export function preserveManualGenerationControls(config) {
  const manual = config?.manualGenerationControls;
  if (!manual || typeof manual !== "object" || Array.isArray(manual)) return config;
  const values = Object.fromEntries(Object.keys(MANUAL_GENERATION_CONTROL_IDS)
    .filter((key) => typeof manual[key] === "number" && Number.isFinite(manual[key]))
    .map((key) => [key, Math.min(1, Math.max(0, manual[key]))]));
  return { ...config, ...values, manualGenerationControls: values };
}
