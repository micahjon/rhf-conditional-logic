import { deleteByPathWithoutMutation as dbp } from "../src/utils/delete-by-path";
import { expect, test } from "vitest";

test("Top-level delete without mutation", () => {
  const startingObject = { a: 1, c: 2 };
  expect(dbp(startingObject, "a")).toStrictEqual({ c: 2 });
  expect(startingObject).toStrictEqual({ a: 1, c: 2 });
});

test("Nested delete without mutation", () => {
  const startingObject = { a: { b: { c: 1, d: 2 } }, c: 2 };
  expect(dbp(startingObject, "a.b.d")).toStrictEqual({
    a: { b: { c: 1 } },
    c: 2,
  });
  expect(startingObject).toStrictEqual({ a: { b: { c: 1, d: 2 } }, c: 2 });
});

test("Should ignore bad paths", () => {
  const startingObject = { a: { b: { c: 1 } } };
  expect(dbp(startingObject, "a.b.e")).toStrictEqual({ a: { b: { c: 1 } } });
  expect(startingObject).toStrictEqual({ a: { b: { c: 1 } } });
});
