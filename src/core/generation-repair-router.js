const REROUTE_MODES = Object.freeze(new Set([
  "harmony-first",
  "groove-first",
  "hook-first",
]));

function normalizeKind(kind) {
  return String(kind ?? "");
}

export function decideGenerationRepairAuthority(kind, diagnosis = {}, config = {}) {
  const requestKind = normalizeKind(kind);
  const focusRoute = REROUTE_MODES.has(String(diagnosis?.focusRoute))
    ? String(diagnosis.focusRoute)
    : null;
  const explicitRoute = config?.compositionRoute != null && String(config.compositionRoute).length > 0;
  const reroute = Boolean(
    diagnosis?.shouldRetry
    && focusRoute
    && !explicitRoute
    && (requestKind === "new" || requestKind === "similar")
  );

  if (reroute) {
    return Object.freeze({
      version: 1,
      owner: "generation-repair-router",
      mode: "composition-reroute",
      phase: "compose",
      focusRoute,
      focusDimension: diagnosis?.focusDimension ?? null,
      focusGroup: diagnosis?.focusGroup ?? null,
      reason: diagnosis?.reason ?? "critic-focus-retry",
      allowsFullRegeneration: true,
      allowsSurgicalPostprocess: true,
    });
  }

  return Object.freeze({
    version: 1,
    owner: "generation-repair-router",
    mode: "surgical-postprocess",
    phase: "post-compose",
    focusRoute,
    focusDimension: diagnosis?.focusDimension ?? null,
    focusGroup: diagnosis?.focusGroup ?? null,
    reason: diagnosis?.reason ?? "postprocess-authority",
    allowsFullRegeneration: false,
    allowsSurgicalPostprocess: true,
  });
}

export function attachGenerationRepairAuthority(config = {}, authority = null) {
  if (!authority) return { ...config };
  return {
    ...config,
    generationRepairAuthority: authority,
  };
}
