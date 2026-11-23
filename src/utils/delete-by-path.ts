// Delete fields from an object by their paths, e.g. ["a.b", "a.c"]
// without mutating said object
export function deleteByPathsWithoutMutation(
  object: Record<string, unknown>,
  paths: readonly string[]
): Record<string, unknown> {
  let result = object;
  // Reuse copies only within this batch, never mutate objects from the input.
  const copies = new WeakSet<object>();

  paths: for (const path of paths) {
    // Recurse into object until we're at the right level
    const keysToRecurse = path.split('.');
    const lastKey = keysToRecurse.pop();
    if (!lastKey) continue;

    // Find the object to delete from before cloning anything.
    let objectToDeleteFrom = result;
    for (const key of keysToRecurse) {
      const child = objectToDeleteFrom[key];
      if (!isObject(child)) continue paths;
      objectToDeleteFrom = child;
    }

    if (result === object) {
      result = { ...object };
      copies.add(result);
    }
    // Recurse down again, updating references to copied objects along the way.
    let objectToUpdate = result;
    for (const key of keysToRecurse) {
      const child = objectToUpdate[key];
      if (!isObject(child)) continue paths;
      if (!copies.has(child)) {
        const copy = Array.isArray(child) ? [...child] : { ...child };
        objectToUpdate[key] = copy;
        copies.add(copy);
      }
      objectToUpdate = objectToUpdate[key] as Record<string, unknown>;
    }

    delete objectToUpdate[lastKey];
  }
  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
