// Source: https://stackoverflow.com/a/57491234/1546808
// Delete from a field path from an object, e.g. "a.b"
export function deleteByPath(object: Record<string, unknown>, path: string) {
  let currentObject = object;
  const parts = path.split(".");
  const last = parts.pop() as string;
  for (const part of parts) {
    // @ts-expect-error TS doesn't like the unknown type
    currentObject = currentObject[part];
    if (!currentObject) return;
  }
  delete currentObject[last];
}
