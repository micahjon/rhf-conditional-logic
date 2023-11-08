// Source: https://stackoverflow.com/a/57491234/1546808
// Delete from a field path from an object, e.g. "a.b"
export function deleteByPathWithoutMutation(
  object: Record<string, unknown>,
  path: string
): Record<string, unknown> {
  // Recurse into object until we're at the right level
  const keysToRecurse = path.split(".");
  const lastKey = keysToRecurse.pop();
  if (!lastKey) return object;

  // Top-level deletion
  if (!keysToRecurse.length) {
    const clone = { ...object };
    delete clone[lastKey];
    return clone;
  }

  // Recurse to right level to find object to mutate
  let objectToDeleteFrom = object;
  for (const key of keysToRecurse) {
    // @ts-expect-error TS doesn't like the unknown type
    objectToDeleteFrom = objectToDeleteFrom[key];

    // If no longer an object, bail!
    if (!objectToDeleteFrom || typeof objectToDeleteFrom !== "object") {
      return object;
    }
  }

  // Clone & delete key
  const objectWithDeletedKey = { ...objectToDeleteFrom };
  delete objectWithDeletedKey[lastKey];

  // Recurse down again, now that we have new object, updating references
  // along the way
  const newParentObject = { ...object };
  let objectToUpdate: object = newParentObject;
  keysToRecurse.forEach((key, index) => {
    if (index < keysToRecurse.length - 1) {
      // @ts-expect-error Clone object at this level
      objectToUpdate[key] = Array.isArray(objectToUpdate[key])
        ? // @ts-expect-error Clone array
          [...objectToUpdate[key]]
        : // @ts-expect-error Clone object
          { ...objectToUpdate[key] };
      // @ts-expect-error Now recurse down to the next level
      objectToUpdate = objectToUpdate[key];
    } else {
      // @ts-expect-error At the very bottom, swap out object
      objectToUpdate[key] = objectWithDeletedKey;
    }
  });

  return newParentObject;
}
