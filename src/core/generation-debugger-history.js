export async function loadGenerationDebuggerEvents(getRepository, limit = 64) {
  try {
    const repository = await getRepository();
    return await repository.recentDebuggerEvents(limit);
  } catch {
    return [];
  }
}
