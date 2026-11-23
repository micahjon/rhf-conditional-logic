// @vitest-environment jsdom
import { zodResolver } from '@hookform/resolvers/zod';
import { createElement } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { Resolver, useForm } from 'react-hook-form';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import {
  FieldConditions,
  GetValues,
  pruneHiddenFields,
  useCondition,
  useConditionalForm,
} from '../src';
import {
  conditions as demoConditions,
  formSchema,
  getDefaultValues,
} from '../tests-e2e/mock-form/schema';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

afterEach(() => {
  act(() => roots.splice(0).forEach(root => root.unmount()));
});

function renderHook<T>(useHook: () => T) {
  let current: T;
  function Harness() {
    current = useHook();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  act(() => root.render(createElement(Harness)));
  return {
    get current() {
      return current;
    },
  };
}

const schema = z.object({
  showNote: z.boolean(),
  note: z.string().min(2).optional(),
  count: z.string().transform(Number),
});
const conditions = {
  note: getValues => getValues('showNote'),
} satisfies FieldConditions<z.input<typeof schema>>;

function renderValidityForms(shouldUnregister = false) {
  const resolver = zodResolver(z.object({ count: z.string().min(1) }));
  const nativeResolver = vi.fn(resolver);
  const conditionalResolver = vi.fn(resolver);
  const result = renderHook(() => {
    const options = { defaultValues: { count: 'valid' }, shouldUnregister };
    const native = useForm({ ...options, resolver: nativeResolver });
    const conditional = useConditionalForm({
      ...options,
      conditions: {},
      resolver: conditionalResolver,
    });
    return {
      native,
      conditional,
      nativeIsValid: native.formState.isValid,
      conditionalIsValid: conditional.formState.isValid,
    };
  });
  return { result, nativeResolver, conditionalResolver };
}

describe('useConditionalForm()', () => {
  test('does not watch numeric-keyed target parents unless the condition reads them', () => {
    type Values = {
      flag: boolean;
      codes: { '0': string; other: string };
    };
    const conditions = {
      'codes.0': getValues => getValues('flag'),
    } satisfies FieldConditions<Values>;
    const render = vi.fn();
    let form: ReturnType<typeof useForm<Values>>;
    function Harness() {
      form = useForm<Values>({
        defaultValues: { flag: true, codes: { '0': '', other: '' } },
      });
      const [visible] = useCondition(
        ['codes.0'],
        conditions,
        form.getValues,
        form.control
      );
      render(visible);
      return null;
    }
    const root = createRoot(document.createElement('div'));
    roots.push(root);
    act(() => root.render(createElement(Harness)));
    render.mockClear();

    act(() => form.setValue('codes.other', 'unrelated edit'));
    expect(render).not.toHaveBeenCalled();
    act(() => form.setValue('codes.0', 'target edit'));
    expect(render).not.toHaveBeenCalled();

    act(() => form.setValue('flag', false));
    expect(render).toHaveBeenCalledOnce();
    expect(render).toHaveBeenLastCalledWith(false);
  });

  test.each([undefined, { enabled: undefined }, { enabled: false }, { enabled: null }])(
    'matches RHF dotted-key lookups with nested flags %j',
    flags => {
      type Values = {
        'flags.enabled': boolean;
        flags?: { enabled?: boolean | null };
        detail: string;
      };
      const values: Values = {
        'flags.enabled': true,
        flags,
        detail: 'keep',
      };
      const result = renderHook(() => useForm<Values>({ defaultValues: values }));
      const observed = vi.fn();
      const conditions = {
        detail: getValues => {
          const enabled = getValues('flags.enabled');
          const [tupleEnabled] = getValues(['flags.enabled']);
          observed(enabled, tupleEnabled);
          return enabled === true;
        },
      } satisfies FieldConditions<Values>;
      const expected = result.current.getValues('flags.enabled');
      const fromGetter = pruneHiddenFields(result.current.getValues, conditions);
      const fromValues = pruneHiddenFields(result.current.getValues(), conditions);
      expect(fromValues).toStrictEqual(fromGetter);
      expect(observed).toHaveBeenCalledTimes(2);
      expect(observed).toHaveBeenNthCalledWith(1, expected, expected);
      expect(observed).toHaveBeenNthCalledWith(2, expected, expected);
      expect('detail' in fromValues).toBe(expected === true);
      expect(result.current.getValues('detail')).toBe('keep');
    }
  );

  test('uses RHF primitive-property and bracket-path lookups when pruning', () => {
    type Values = {
      text: string;
      'text.length': number;
      rows: { selected: boolean }[];
      'rows[0].selected': boolean;
      detail: string;
    };
    const values: Values = {
      text: 'abc',
      'text.length': 1,
      rows: [{ selected: true }],
      'rows[0].selected': false,
      detail: 'keep',
    };
    const result = renderHook(() => useForm<Values>({ defaultValues: values }));
    const observed = vi.fn();
    const conditions = {
      detail: getValues => {
        const length = getValues('text.length');
        const [tupleLength, selected] = getValues(['text.length', 'rows[0].selected']);
        observed(length, tupleLength, selected);
        return length === 3 && selected === true;
      },
    } satisfies FieldConditions<Values>;
    const fromGetter = pruneHiddenFields(result.current.getValues, conditions);
    const fromValues = pruneHiddenFields(result.current.getValues(), conditions);
    expect(fromValues).toStrictEqual(fromGetter);
    expect(fromValues.detail).toBe('keep');
    expect(observed).toHaveBeenNthCalledWith(1, 3, 3, true);
    expect(observed).toHaveBeenNthCalledWith(2, 3, 3, true);
    expect(result.current.getValues()).toStrictEqual(values);
  });

  test('validates RHF values rather than defaults before mount', async () => {
    const { result, nativeResolver, conditionalResolver } = renderValidityForms(true);
    await act(async () => {});
    expect(nativeResolver).toHaveBeenCalled();
    expect(nativeResolver.mock.lastCall?.[0]).toStrictEqual({});
    expect(conditionalResolver.mock.lastCall?.[0]).toStrictEqual(
      nativeResolver.mock.lastCall?.[0]
    );
    expect(result.current.nativeIsValid).toBe(false);
    expect(result.current.conditionalIsValid).toBe(false);
  });

  test('skips an absent target before registration without suppressing validation', async () => {
    const schema = z.object({
      count: z.string().min(1),
      note: z.string().optional(),
    });
    const condition = vi.fn(
      (getValues: GetValues<z.input<typeof schema>>) => getValues('count').length > 0
    );
    const resolver = vi.fn(zodResolver(schema));
    const result = renderHook(() => {
      const form = useConditionalForm<z.input<typeof schema>>({
        conditions: { note: condition },
        resolver,
        defaultValues: { count: 'valid', note: 'saved' },
        shouldUnregister: true,
      });
      return { form, isValid: form.formState.isValid };
    });
    await act(async () => {});
    expect(condition).not.toHaveBeenCalled();
    expect(resolver.mock.lastCall?.[0]).toStrictEqual({});
    expect(result.current.isValid).toBe(false);

    act(() => {
      result.current.form.register('count');
      result.current.form.register('note');
      result.current.form.setValue('count', '');
      result.current.form.setValue('note', 'saved');
    });
    const onInvalid = vi.fn();
    await act(async () => {
      await result.current.form.handleSubmit(vi.fn(), onInvalid)();
    });
    expect(condition).toHaveBeenCalled();
    expect(resolver.mock.lastCall?.[0]).toStrictEqual({ count: '' });
    expect(onInvalid.mock.calls[0][0]).toHaveProperty('count');
  });

  test('matches RHF validity after resetting while keeping default values', async () => {
    const { result, nativeResolver, conditionalResolver } = renderValidityForms();
    await act(async () => {});
    expect(result.current.conditionalIsValid).toBe(true);
    nativeResolver.mockClear();
    conditionalResolver.mockClear();

    await act(async () => {
      result.current.native.reset({}, { keepDefaultValues: true });
      result.current.conditional.reset({}, { keepDefaultValues: true });
    });
    expect(nativeResolver).toHaveBeenCalled();
    expect(conditionalResolver).toHaveBeenCalled();
    expect(conditionalResolver.mock.lastCall?.[0]).toStrictEqual(
      nativeResolver.mock.lastCall?.[0]
    );
    expect(result.current.conditionalIsValid).toBe(result.current.nativeIsValid);
    expect(result.current.conditional.getValues()).toStrictEqual(
      result.current.native.getValues()
    );
  });

  test('prunes before validation, submits transformed output, and preserves current form values', async () => {
    const result = renderHook(() => {
      const form = useConditionalForm<
        z.input<typeof schema>,
        unknown,
        z.output<typeof schema>
      >({
        conditions,
        resolver: zodResolver(schema),
        defaultValues: { showNote: false, note: '.', count: '42' },
      });
      const [showNote] = useCondition(
        ['note'],
        conditions,
        form.getValues,
        form.control
      );
      return { form, showNote };
    });
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await act(async () => {
      await result.current.form.handleSubmit(onValid, onInvalid)();
    });
    expect(onValid.mock.calls[0][0]).toStrictEqual({ showNote: false, count: 42 });
    expect(onInvalid).not.toHaveBeenCalled();
    expect(result.current.form.getValues()).toStrictEqual({
      showNote: false,
      note: '.',
      count: '42',
    });
    expect(result.current.showNote).toBe(false);

    act(() => result.current.form.setValue('showNote', true));
    expect(result.current.showNote).toBe(true);
    onValid.mockClear();
    await act(async () => {
      await result.current.form.handleSubmit(onValid, onInvalid)();
    });
    expect(onValid).not.toHaveBeenCalled();
    expect(onInvalid.mock.calls[0][0].note).toMatchObject({ type: 'too_small' });
  });

  test('raw resolver output stays pruned but is not transformed', async () => {
    const result = renderHook(() =>
      useConditionalForm<z.input<typeof schema>>({
        conditions,
        resolver: zodResolver(schema, undefined, { raw: true }),
        defaultValues: { showNote: false, note: '.', count: '42' },
      })
    );
    const onValid = vi.fn();
    await act(async () => {
      await result.current.handleSubmit(onValid)();
    });
    expect(onValid.mock.calls[0][0]).toStrictEqual({ showNote: false, count: '42' });
  });

  test.each(['sync', 'async'] as const)(
    'forwards context and validation options to a custom %s resolver',
    async mode => {
      type Input = z.input<typeof schema>;
      type Output = { count: number };
      type Context = { multiplier: number };
      const context = { multiplier: 2 };
      const resolve = vi.fn<Parameters<Resolver<Input, Context, Output>>, Output>(
        (values, resolverContext) => ({
          count: Number(values.count) * (resolverContext?.multiplier ?? 1),
        })
      );
      const resolver: Resolver<Input, Context, Output> = (values, ctx, options) => {
        const output = { values: resolve(values, ctx, options), errors: {} };
        return mode === 'async' ? Promise.resolve(output) : output;
      };
      const result = renderHook(() =>
        useConditionalForm({
          conditions,
          resolver,
          context,
          criteriaMode: 'all',
          defaultValues: { showNote: false, note: '.', count: '21' },
        })
      );
      const onValid = vi.fn();
      await act(async () => {
        await result.current.handleSubmit(onValid)();
      });
      expect(resolve).toHaveBeenLastCalledWith(
        { showNote: false, count: '21' },
        context,
        expect.objectContaining({ criteriaMode: 'all' })
      );
      expect(onValid.mock.calls[0][0]).toStrictEqual({ count: 42 });
    }
  );

  test('rejects unselected nullable fields while submitting non-null selections', async () => {
    const result = renderHook(() =>
      useConditionalForm({
        conditions: {},
        resolver: zodResolver(formSchema),
        defaultValues: getDefaultValues(),
      })
    );
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await act(async () => {
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onValid).not.toHaveBeenCalled();
    expect(onInvalid.mock.calls[0][0].caterer.message).toBe('Please select a caterer');
    expect(onInvalid.mock.calls[0][0].guests[0].age.message).toBe(
      'Please select an age'
    );
    act(() => {
      result.current.setValue('contactName', 'Test');
      result.current.setValue('contactEmail', 'test@example.com');
      result.current.setValue('caterer', 'Delta BBQ');
      result.current.setValue('guests.0.name', 'Guest');
      result.current.setValue('guests.0.age', '21+');
    });
    await act(async () => {
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onValid.mock.calls[0][0]).toMatchObject({
      caterer: 'Delta BBQ',
      guests: [{ age: '21+' }],
    });
  });

  test('clearing selections preserves nullable form values and blocks resubmission', async () => {
    const result = renderHook(() =>
      useConditionalForm<
        z.input<typeof formSchema>,
        unknown,
        z.output<typeof formSchema>
      >({
        conditions: demoConditions,
        resolver: zodResolver(formSchema),
        defaultValues: {
          ...getDefaultValues(),
          contactName: 'Test',
          contactEmail: 'test@example.com',
          caterer: 'Delta BBQ',
          guests: [{ name: 'Guest', age: '21+', wine: 'White' }],
        },
      })
    );
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await act(async () => {
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onValid).toHaveBeenCalledOnce();
    expect(onInvalid).not.toHaveBeenCalled();

    act(() => {
      result.current.setValue('caterer', null);
      result.current.setValue('guests.0.age', null);
      result.current.setValue('contactName', '');
    });
    onValid.mockClear();
    await act(async () => {
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onValid).not.toHaveBeenCalled();
    expect(onInvalid.mock.calls[0][0]).toMatchObject({
      contactName: { type: 'too_small' },
      caterer: { message: 'Please select a caterer' },
      guests: [{ age: { message: 'Please select an age' } }],
    });
    expect(result.current.getValues('caterer')).toBeNull();
    expect(result.current.getValues('guests.0.age')).toBeNull();
    expect(result.current.getValues('guests.0.wine')).toBe('White');
  });

  test('propagates resolver exceptions', async () => {
    const failure = new Error('Resolver failed');
    const result = renderHook(() =>
      useConditionalForm({
        conditions: {},
        defaultValues: { count: '' },
        resolver: () => {
          throw failure;
        },
      })
    );
    await act(async () => {
      await expect(result.current.handleSubmit(vi.fn())()).rejects.toBe(failure);
    });
  });
});
