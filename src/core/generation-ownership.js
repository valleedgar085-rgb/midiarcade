/** A generation may commit or clean up only while it owns the current job. */
export function createGenerationOwnership() {
  let sequence = 0;
  let current = null;
  return Object.freeze({
    begin() {
      current = ++sequence;
      return current;
    },
    isCurrent(operation) {
      return current !== null && operation === current;
    },
    finish(operation) {
      if (current === null || operation !== current) return false;
      current = null;
      return true;
    },
    invalidate() {
      current = null;
    },
  });
}
