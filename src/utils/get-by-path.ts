// Get value at a field path from an object, e.g. "a.b"
// Based on: https://stackoverflow.com/a/6491621/1546808
export function getByPath(object: Record<string, unknown>) {
  return function (path: string) {
    // Recurse into object until we're at the right level
    const keys: string[] = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = object;
    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  };
}
