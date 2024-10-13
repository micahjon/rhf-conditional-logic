import { get } from 'lodash-es';
import { afterAll, describe, expect, it, test, vi } from 'vitest';
import { getConditionalLogic as gcl } from '../src/utils/conditional-logic';

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

describe('mocking console.warn...', () => {
  const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  afterAll(() => {
    consoleWarnMock.mockReset();
  });

  it('Log warning when looking up invalid condition', () => {
    expect(gcl(['not_a_valid_condition'], conditions, getValues)).toStrictEqual([true]);
    expect(consoleWarnMock).toHaveBeenCalledOnce();
    expect(consoleWarnMock).toHaveBeenLastCalledWith(
      'Missing conditional logic for "not_a_valid_condition"'
    );
  });
});
