import { deleteByPathsWithoutMutation } from '../src/utils/delete-by-path';
import { expect, test } from 'vitest';

test('Top-level delete without mutation', () => {
  const startingObject = { a: 1, c: 2 };
  expect(deleteByPathsWithoutMutation(startingObject, ['a'])).toStrictEqual({ c: 2 });
  expect(startingObject).toStrictEqual({ a: 1, c: 2 });
});

test('Nested delete without mutation', () => {
  const startingObject = { a: { b: { c: 1, d: 2 } }, c: 2 };
  expect(deleteByPathsWithoutMutation(startingObject, ['a.b.d'])).toStrictEqual({
    a: { b: { c: 1 } },
    c: 2,
  });
  expect(startingObject).toStrictEqual({ a: { b: { c: 1, d: 2 } }, c: 2 });
});

test('Should ignore bad paths', () => {
  const startingObject = { a: { b: { c: 1 } } };
  expect(deleteByPathsWithoutMutation(startingObject, ['a.b.e'])).toStrictEqual({
    a: { b: { c: 1 } },
  });
  expect(startingObject).toStrictEqual({ a: { b: { c: 1 } } });
});

test('batch deletion preserves frozen rows and unrelated branches', () => {
  const unchanged = Object.freeze({ note: 'keep' });
  const input = Object.freeze({
    rows: Object.freeze([
      Object.freeze({ first: 'hide', second: 'hide', keep: 'keep' }),
      unchanged,
    ]),
    untouched: unchanged,
  });
  const result = deleteByPathsWithoutMutation(input, ['rows.0.first', 'rows.0.second']);
  expect(result).toStrictEqual({
    rows: [{ keep: 'keep' }, { note: 'keep' }],
    untouched: unchanged,
  });
  expect(result.rows).not.toBe(input.rows);
  expect(result.untouched).toBe(unchanged);
  expect((result.rows as typeof input.rows)[1]).toBe(unchanged);
  expect(input.rows[0]).toStrictEqual({ first: 'hide', second: 'hide', keep: 'keep' });
  expect(deleteByPathsWithoutMutation(input, ['rows.0.first'])).toStrictEqual({
    rows: [{ second: 'hide', keep: 'keep' }, { note: 'keep' }],
    untouched: unchanged,
  });
});

test.each([
  ['group.note', 'group'],
  ['group', 'group.note'],
])('batch deletion handles overlapping parent/child paths: %s, %s', (...paths) => {
  const input = { group: { note: 'hide', nested: { detail: 'hide' } }, keep: true };
  expect(deleteByPathsWithoutMutation(input, paths)).toStrictEqual({ keep: true });
  expect(input.group).toStrictEqual({ note: 'hide', nested: { detail: 'hide' } });
});
