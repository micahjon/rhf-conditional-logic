import { cloneDeep, get } from 'lodash-es';
import { FieldValues, UseFormGetValues } from 'react-hook-form';
import { describe, expect, test, vi } from 'vitest';
import { FieldConditions, pruneHiddenFields } from '../src';

// pruneHiddenFields() is what useConditionalForm() runs before validation. Test
// it directly with plain values + conditions (no Zod). BlankForm mirrors the
// README's nullable "blank" input shape.
type BlankForm = {
  contactName: string;
  caterer: 'Elephants Catering' | 'Delta BBQ' | 'Other' | null;
  otherCaterer?: string;
  guests: {
    name: string;
    age: '0-5' | '6-12' | '13-20' | '21+' | null;
    wine?: 'Red' | 'White' | 'None';
  }[];
};

const conditions = {
  otherCaterer: getValues => getValues('caterer') === 'Other',
  'guests.#.wine': getValues => getValues('guests.#.age') === '21+',
} satisfies FieldConditions<BlankForm>;

// Mimics RHF's getValues(): no args → all values, a path → one value, an array
// → an array. Typed as UseFormGetValues so pruneHiddenFields() can infer the
// field-values type from it.
function makeGetValues<T extends FieldValues>(values: T): UseFormGetValues<T> {
  return ((paths?: string | string[]) => {
    if (paths === undefined) return values;
    return Array.isArray(paths)
      ? paths.map(path => get(values, path))
      : get(values, paths);
  }) as UseFormGetValues<T>;
}

describe.each(['values', 'getValues'] as const)(
  'pruneHiddenFields(%s, conditions)',
  mode => {
    function prune<T extends FieldValues>(values: T, conditions: FieldConditions<T>) {
      return mode === 'values'
        ? pruneHiddenFields(values, conditions)
        : pruneHiddenFields(makeGetValues<T>(values), conditions);
    }

    test('prunes a top-level field whose condition is false', () => {
      const values: BlankForm = {
        contactName: 'Micah',
        caterer: 'Elephants Catering',
        otherCaterer: 'should be removed',
        guests: [{ name: 'Bob', age: '13-20' }],
      };
      const pruned = prune(values, conditions);
      expect(pruned).toStrictEqual({
        contactName: 'Micah',
        caterer: 'Elephants Catering',
        guests: [{ name: 'Bob', age: '13-20' }],
      });
      expect('otherCaterer' in pruned).toBe(false);
    });

    test('keeps a top-level field whose condition is true', () => {
      const values: BlankForm = {
        contactName: 'Micah',
        caterer: 'Other',
        otherCaterer: 'Tacos Inc',
        guests: [{ name: 'Bob', age: '13-20' }],
      };
      const pruned = prune(values, conditions);
      expect(pruned.otherCaterer).toBe('Tacos Inc');
    });

    test('prunes per-index array fields independently via the # wildcard', () => {
      const values: BlankForm = {
        contactName: 'Micah',
        caterer: 'Delta BBQ',
        guests: [
          { name: 'Old Enough', age: '21+', wine: 'Red' }, // kept
          { name: 'Too Young', age: '6-12', wine: 'White' }, // pruned
          { name: 'Also Old', age: '21+', wine: 'None' }, // kept
        ],
      };
      const pruned = prune(values, conditions);
      expect(pruned.guests[0].wine).toBe('Red');
      expect('wine' in pruned.guests[1]).toBe(false);
      expect(pruned.guests[2].wine).toBe('None');
    });

    test('does not mutate the original values object', () => {
      const values: BlankForm = {
        contactName: 'Micah',
        caterer: 'Elephants Catering',
        otherCaterer: 'remove me',
        guests: [{ name: 'Bob', age: '6-12', wine: 'Red' }],
      };
      const snapshot = cloneDeep(values);
      prune(values, conditions);
      expect(values).toStrictEqual(snapshot);
    });

    test('handles an empty guests array without throwing', () => {
      const values: BlankForm = {
        contactName: 'Micah',
        caterer: 'Other',
        otherCaterer: 'Tacos Inc',
        guests: [],
      };
      const pruned = prune(values, conditions);
      expect(pruned).toStrictEqual({
        contactName: 'Micah',
        caterer: 'Other',
        otherCaterer: 'Tacos Inc',
        guests: [],
      });
    });

    test('prunes nested wildcard fields in incomplete drafts without validating or mutating them', () => {
      type Draft = {
        groups: {
          enabled: boolean;
          entries?: { selected: boolean; detail?: string; amount: number | null }[];
        }[];
      };
      const values: Draft = {
        groups: [
          {
            enabled: false,
            entries: [{ selected: true, detail: '.', amount: null }],
          },
          {
            enabled: true,
            entries: [
              { selected: true, detail: 'Keep', amount: NaN },
              { selected: false, detail: '.', amount: null },
            ],
          },
          { enabled: false },
        ],
      };
      const conditions = {
        'groups.#.entries.#.detail': getValues => {
          const [group, entry] = getValues(['groups.#', 'groups.#.entries.#']);
          return group.enabled && entry?.selected === true;
        },
      } satisfies FieldConditions<Draft>;
      const snapshot = cloneDeep(values);
      const pruned = prune(values, conditions);
      expect(pruned).toStrictEqual({
        groups: [
          { enabled: false, entries: [{ selected: true, amount: null }] },
          {
            enabled: true,
            entries: [
              { selected: true, detail: 'Keep', amount: NaN },
              { selected: false, amount: null },
            ],
          },
          { enabled: false },
        ],
      });
      expect(values).toStrictEqual(snapshot);
    });

    test.each([
      ['groups.#', true],
      ['groups.0', false],
      ['groups.#.entries.#', false],
      ['groups.#.entries.0', true],
    ] as const)('rejects whole-array-item target %s', (path, visible) => {
      const values = {
        groups: [{ entries: [{ detail: 'keep' }] }],
      };
      const snapshot = cloneDeep(values);
      const condition = vi.fn(() => visible);
      expect(() => prune(values, { [path]: condition })).toThrow(
        'Conditions cannot target entire array items'
      );
      expect(condition).not.toHaveBeenCalled();
      expect(values).toStrictEqual(snapshot);
    });

    test('rejects a whole-item wildcard even when the array is empty', () => {
      const values: { groups: { detail: string }[] } = { groups: [] };
      expect(() =>
        prune(values, {
          // @ts-expect-error exercise invalid JavaScript configuration
          'groups.#': () => false,
        })
      ).toThrow('Conditions cannot target entire array items');
    });

    test('still permits numeric object-property targets', () => {
      const values = { codes: { '0': 'remove', '1': 'keep' } };
      expect(prune(values, { 'codes.0': () => false })).toStrictEqual({
        codes: { '1': 'keep' },
      });
    });

    test('rejects root arrays instead of silently ignoring their wildcards', () => {
      const values = [{ visible: false, note: 'hidden' }];
      const condition = vi.fn(() => false);
      // @ts-expect-error exercise unsupported JavaScript form values
      expect(() => prune(values, { '#.note': condition })).toThrow(
        'Form values must be an object, not a root array'
      );
      expect(condition).not.toHaveBeenCalled();
      expect(values).toStrictEqual([{ visible: false, note: 'hidden' }]);
    });

    test('does not evaluate rules for absent targets', () => {
      type Values = { count?: string; note?: string; flag: boolean };
      const absentRule = vi.fn(() => {
        throw new Error('Absent targets must not evaluate their conditions');
      });
      const values: Values = { flag: true };
      expect(prune(values, { note: absentRule })).toStrictEqual(values);
      const undefinedTarget: Values = { flag: true, note: undefined };
      expect(prune(undefinedTarget, { note: absentRule })).toStrictEqual(
        undefinedTarget
      );
      expect(absentRule).not.toHaveBeenCalled();
      expect(
        prune({ count: '', note: '.', flag: false }, { note: () => false })
      ).toStrictEqual({ count: '', flag: false });
    });

    test('still evaluates present falsy targets', () => {
      const values = { flag: false, count: 0, note: '', choice: null };
      const condition = vi.fn(() => false);
      expect(
        prune(values, {
          flag: condition,
          count: condition,
          note: condition,
          choice: condition,
        })
      ).toStrictEqual({});
      expect(condition).toHaveBeenCalledTimes(4);
    });

    test('rejects bracket targets rather than deleting from a literal-key collision', () => {
      const values = {
        groups: [{ entries: [{ note: 'nested' }] }],
        'groups[0]': { entries: [{ note: 'literal' }] },
      };
      const snapshot = cloneDeep(values);
      const condition = vi.fn(() => false);
      expect(() => prune(values, { 'groups[0].entries.#.note': condition })).toThrow(
        'Condition targets must use dot-separated paths'
      );
      expect(condition).not.toHaveBeenCalled();
      expect(values).toStrictEqual(snapshot);
    });

    test.each(['direct', 'wildcard'] as const)(
      'rejects literal dotted-key %s targets without mutation',
      mode => {
        const values = {
          'groups.members': [{ note: 'literal' }],
          'direct.note': 'literal',
        };
        const condition = vi.fn(() => false);
        const target = mode === 'direct' ? 'direct.note' : 'groups.members.#.note';
        expect(() => prune(values, { [target]: condition })).toThrow(
          'Condition targets cannot use literal dotted keys'
        );
        expect(condition).not.toHaveBeenCalled();
        expect(values).toStrictEqual({
          'groups.members': [{ note: 'literal' }],
          'direct.note': 'literal',
        });
      }
    );

    test('evaluates every condition against the unpruned values', () => {
      type Values = { first?: string; second?: string };
      const values: Values = { first: 'present', second: 'keep' };
      const conditions = {
        first: () => false,
        second: getValues => getValues('first') === 'present',
      } satisfies FieldConditions<Values>;
      expect(prune(values, conditions)).toStrictEqual({ second: 'keep' });
      expect(values).toStrictEqual({ first: 'present', second: 'keep' });
    });
  }
);
