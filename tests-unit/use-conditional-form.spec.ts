// @vitest-environment jsdom
import { zodResolver } from '@hookform/resolvers/zod';
import { createElement } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { Resolver, useForm } from 'react-hook-form';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { FieldConditions, useCondition, useConditionalForm } from '../src';
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

  test('prunes before validation, submits transformed output, and preserves editing values', async () => {
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

  test('clearing selections preserves nullable editing values and blocks resubmission', async () => {
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
