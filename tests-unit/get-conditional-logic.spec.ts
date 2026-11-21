import { get } from 'lodash-es';
import { UseFormGetValues } from 'react-hook-form';
import { afterAll, describe, expect, it, test, vi } from 'vitest';
import { FieldConditions } from '../src';
import {
  getConditionalLogic as gcl,
  getConditionalLogicWithDependencies,
} from '../src/utils/conditional-logic';

const formValues = {
  contactName: 'Micah',
  contactEmail: '',
  caterer: null,
  guests: [
    {
      name: 'Ben',
      age: 24,
      hasGloves: true,
      bottles: [
        {
          grape: 'Tempranillo',
          sips: 3,
          isSmudgedByThisGuest: undefined,
          isSmudgedByFirstGuest: undefined,
        },
      ],
    },
    {
      name: 'Kate',
      age: 28,
      hasGloves: false,
      bottles: [
        {
          grape: 'Tempranillo',
          sips: 2,
          isSmudgedByThisGuest: undefined,
          isSmudgedByFirstGuest: undefined,
        },
      ],
    },
    {
      name: 'Joseph',
      age: 16,
      hasGloves: false,
    },
  ],
};
const conditions: Record<string, (getValues: (key: string) => unknown) => boolean> = {
  contactEmail: gv => (gv('contactName') as string).length > 0,
  'guests.#.bottles.#.isSmudgedByThisGuest': gv =>
    (gv('guests.#.hasGloves') as boolean | undefined) !== true,
  'guests.#.bottles.#.isSmudgedByFirstGuest': gv =>
    (gv('guests.0.hasGloves') as boolean | undefined) !== true,
};
const getValues = ((paths: string | string[]) =>
  Array.isArray(paths)
    ? paths.map(path => get(formValues, path))
    : get(formValues, paths)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

test('Basic case', () => {
  expect(gcl(['contactEmail'], conditions, getValues)).toStrictEqual([true]);
});

test('Referencing parent in same lineage', () => {
  expect(
    gcl(['guests.0.bottles.0.isSmudgedByThisGuest'], conditions, getValues)
  ).toStrictEqual([false]);
  expect(
    gcl(['guests.1.bottles.0.isSmudgedByThisGuest'], conditions, getValues)
  ).toStrictEqual([true]);
});

test('Referencing parent in different lineage', () => {
  expect(
    gcl(['guests.0.bottles.0.isSmudgedByFirstGuest'], conditions, getValues)
  ).toStrictEqual([false]);
  expect(
    gcl(['guests.1.bottles.0.isSmudgedByFirstGuest'], conditions, getValues)
  ).toStrictEqual([false]);
});

test('Tracks concrete dependencies for wildcard lookups of multiple fields', () => {
  const typedGetValues: UseFormGetValues<typeof formValues> = getValues;
  const conditions = {
    'guests.#.bottles.#.isSmudgedByThisGuest': getValues => {
      const [hasGloves, sips] = getValues([
        'guests.#.hasGloves',
        'guests.#.bottles.#.sips',
      ]);
      return !hasGloves && typeof sips === 'number' && sips > 0;
    },
  } satisfies FieldConditions<typeof formValues>;
  const result = getConditionalLogicWithDependencies(
    ['guests.1.bottles.0.isSmudgedByThisGuest'],
    conditions,
    typedGetValues
  );
  expect(result.formFieldVisibility).toStrictEqual([true]);
  expect([...result.dependencies]).toStrictEqual([
    'guests.1.hasGloves',
    'guests.1.bottles.0.sips',
  ]);
});

test.each([false, true])(
  'tracks only condition reads for numeric object keys (reads parent: %s)',
  readsParent => {
    const values = { flag: true, codes: { '0': 'keep' } };
    const getValues = ((paths: string | readonly string[]) =>
      Array.isArray(paths)
        ? paths.map(path => get(values, path))
        : get(values, paths)) as UseFormGetValues<typeof values>;
    const conditions = {
      'codes.0': getValues =>
        readsParent
          ? getValues('codes')['0'] === 'keep' && getValues('flag')
          : getValues('flag'),
    } satisfies FieldConditions<typeof values>;
    const result = getConditionalLogicWithDependencies(
      ['codes.0'],
      conditions,
      getValues
    );
    expect(result.formFieldVisibility).toStrictEqual([true]);
    expect([...result.dependencies]).toStrictEqual(
      readsParent ? ['codes', 'flag'] : ['flag']
    );
  }
);

test('rejects numeric array-item targets without evaluating their conditions', () => {
  const values = { codes: ['keep'], flag: true };
  const getValues = ((paths: string | readonly string[]) =>
    Array.isArray(paths)
      ? paths.map(path => get(values, path))
      : get(values, paths)) as UseFormGetValues<typeof values>;
  const condition = vi.fn(() => true);
  expect(() =>
    getConditionalLogicWithDependencies(
      // @ts-expect-error exercise an invalid JavaScript condition target
      ['codes.0'],
      { 'codes.0': condition },
      getValues
    )
  ).toThrow('Conditions cannot target entire array items');
  expect(condition).not.toHaveBeenCalled();
});

test('still evaluates visibility for an absent target', () => {
  const values: { count: string; note?: string } = { count: 'shown' };
  const getValues = ((path: string) => get(values, path)) as UseFormGetValues<
    typeof values
  >;
  const condition = vi.fn(() => true);
  const result = getConditionalLogicWithDependencies(
    ['note'],
    { note: condition },
    getValues
  );
  expect(result.formFieldVisibility).toStrictEqual([true]);
  expect(condition).toHaveBeenCalledOnce();
});

test('keeps exact precedence and first wildcard match across evaluations', () => {
  const values = { rows: [{ notes: [{ detail: 'value' }] }] };
  const getValues = ((path: string) => get(values, path)) as UseFormGetValues<
    typeof values
  >;
  const wildcards = {
    'rows.#.notes.#.detail': (): boolean => false,
    'rows.0.notes.#.detail': () => true,
  } satisfies FieldConditions<typeof values>;
  const conditions = {
    ...wildcards,
    'rows.0.notes.0.detail': () => true,
  } satisfies FieldConditions<typeof values>;
  const paths = ['rows.0.notes.0.detail'] as const;
  expect(gcl(paths, conditions, getValues)).toStrictEqual([true]);
  expect(gcl(paths, wildcards, getValues)).toStrictEqual([false]);
  wildcards['rows.#.notes.#.detail'] = () => true;
  expect(gcl(paths, wildcards, getValues)).toStrictEqual([true]);
});

describe('mocking console.warn...', () => {
  const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  afterAll(() => {
    consoleWarnMock.mockReset();
  });

  it('Log warning when looking up invalid condition', () => {
    expect(gcl(['not_a_valid_condition'], conditions, getValues)).toStrictEqual([true]);
    expect(consoleWarnMock).toHaveBeenCalledOnce();
    expect(consoleWarnMock).toHaveBeenLastCalledWith(
      'Missing RHF conditional logic for "not_a_valid_condition"'
    );
  });
});
