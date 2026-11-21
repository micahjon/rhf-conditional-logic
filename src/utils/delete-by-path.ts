// Delete a field from an object by its path, e.g. "a.b"
// without mutating said object
export function deleteByPathWithoutMutation(
  object: Record<string, unknown>,
  path: string
): Record<string, unknown> {
  return deleteByPathsWithoutMutation(object, [path]);
}

export function deleteByPathsWithoutMutation(
  object: Record<string, unknown>,
  paths: readonly string[]
): Record<string, unknown> {
  let result = object;
  // Reuse copies only within this batch, never mutate objects from the input.
  const copies = new WeakSet<object>();

  paths: for (const path of paths) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    if (!lastKey) continue;

    let parent = result;
    for (const key of keys) {
      const child = parent[key];
      if (!isObject(child)) continue paths;
      parent = child;
    }

    if (result === object) {
      result = { ...object };
      copies.add(result);
    }
    parent = result;
    for (const key of keys) {
      const child = parent[key];
      if (!isObject(child)) continue paths;
      if (!copies.has(child)) {
        const copy = Array.isArray(child) ? [...child] : { ...child };
        parent[key] = copy;
        copies.add(copy);
      }
      parent = parent[key] as Record<string, unknown>;
    }

    delete parent[lastKey];
  }
  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
