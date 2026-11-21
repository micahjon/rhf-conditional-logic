/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Compile-time tests for the public API, checked by `npm run test:types`.
 * Nothing runs — the hooks sit in functions that are never called; a type
 * regression fails the tsc check.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FieldPathValue,
  FieldValues,
  Resolver,
  ResolverOptions,
  ResolverResult,
  UseFormGetValues,
  useForm,
} from 'react-hook-form';
import { z } from 'zod';
import {
  FieldConditions,
  FieldConditionPath,
  GetValues,
  useCondition,
  useConditionalForm,
  pruneHiddenFields,
} from '../src';
import {
  BlankFormSchema,
  FormSchema,
  conditions,
  formSchema,
} from '../tests-e2e/mock-form/schema';

// --- Type-assertion helpers ---------------------------------------------------

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
  ? true
  : false;
type Expect<T extends true> = T;
function expectType<T>(_value: T): void {}

// --- FieldConditions / GetValues inference -----------------------------------

function conditionTypes(getValues: GetValues<BlankFormSchema>) {
  const _bad = {
    // @ts-expect-error "notAField" is not a path in the schema
    notAField: getValues => getValues('caterer') === 'Other',
  } satisfies FieldConditions<BlankFormSchema>;

  // Single field returns the value at that path (nullable in the blank schema)
  expectType<'Elephants Catering' | 'Delta BBQ' | 'Other' | null>(getValues('caterer'));
  // # wildcard resolves to the element type
  expectType<'0-5' | '6-12' | '13-20' | '21+' | null>(getValues('guests.#.age'));
  // @ts-expect-error not a valid field path
  getValues('nope');
}

// --- useConditionalForm: input/output split ----------------------------------

function inputOutputSplit() {
  type _nullableCatererInput = Expect<
    Equal<
      BlankFormSchema['caterer'],
      'Elephants Catering' | 'Delta BBQ' | 'Other' | null
    >
  >;
  type _nullableGuestAgeInput = Expect<
    Equal<
      BlankFormSchema['guests'][number]['age'],
      '0-5' | '6-12' | '13-20' | '21+' | null
    >
  >;
  type _nonnullableCatererOutput = Expect<
    Equal<FormSchema['caterer'], Exclude<BlankFormSchema['caterer'], null>>
  >;
  type _nonnullableGuestAgeOutput = Expect<
    Equal<
      FormSchema['guests'][number]['age'],
      Exclude<BlankFormSchema['guests'][number]['age'], null>
    >
  >;
  const form = useConditionalForm<BlankFormSchema, unknown, FormSchema>({
    conditions,
    resolver: zodResolver(formSchema),
    defaultValues: { contactName: '', contactEmail: '', caterer: null, guests: [] },
  });

  // handleSubmit hands the *validated output* to the success callback
  form.handleSubmit(data => {
    type _outputIsFormSchema = Expect<Equal<typeof data, FormSchema>>;
    expectType<FormSchema>(data);
  });

  // getValues / register operate on the *input* shape (caterer may be null)
  expectType<'Elephants Catering' | 'Delta BBQ' | 'Other' | null>(
    form.getValues('caterer')
  );

  // control's output type differs from its input type, yet is accepted
  const visibility = useCondition(
    ['otherCaterer', 'guests.0.wine'],
    conditions,
    form.getValues,
    form.control
  );
  type _visibilityIsBooleanList = Expect<Equal<typeof visibility, readonly boolean[]>>;
  const [showOther] = visibility;
  expectType<boolean>(showOther);
  // @ts-expect-error only paths with a condition are accepted
  useCondition(['contactName'], conditions, form.getValues, form.control);
}

// --- Backwards compatibility: single generic still works ---------------------

function singleGenericStillWorks() {
  const form = useConditionalForm<BlankFormSchema>({
    conditions,
    resolver: zodResolver(formSchema),
    defaultValues: { contactName: '', contactEmail: '', caterer: null, guests: [] },
  });
  // Output defaults to the input shape when no third generic is provided
  form.handleSubmit(data => {
    type _outputDefaultsToInput = Expect<Equal<typeof data, BlankFormSchema>>;
  });
}

// --- A resolver whose schema has no transform (input === output) -------------

function inferredOutputForPlainSchema() {
  const plain = z.object({ a: z.string(), b: z.number().optional() });
  type Plain = z.infer<typeof plain>;
  const form = useConditionalForm<Plain, unknown, Plain>({
    conditions: { b: getValues => getValues('a').length > 0 },
    resolver: zodResolver(plain),
    defaultValues: { a: '' },
  });
  form.handleSubmit(data => expectType<Plain>(data));
}

// --- pruneHiddenFields keeps the input type ----------------------------------

function pruneKeepsInputType(getValues: UseFormGetValues<BlankFormSchema>) {
  const result = pruneHiddenFields(getValues, conditions);
  type _resultIsInputShape = Expect<Equal<typeof result, BlankFormSchema>>;
  expectType<BlankFormSchema>(result);
}

function pruneValuesKeepsInputType(values: BlankFormSchema) {
  const result = pruneHiddenFields(values, conditions);
  type _resultIsInputShape = Expect<Equal<typeof result, BlankFormSchema>>;
  // @ts-expect-error pruning does not validate nullable editing values
  expectType<FormSchema>(result);
}

function pruneValuesInfersConditions() {
  type Values = {
    enabled: boolean;
    detail?: string;
    rows: { selected: boolean; note?: string }[];
  };
  const values: Values = { enabled: false, rows: [] };
  const result = pruneHiddenFields(values, {
    detail: getValues => {
      const [enabled, detail] = getValues(['enabled', 'detail']);
      type _enabled = Expect<Equal<typeof enabled, boolean>>;
      type _detail = Expect<Equal<typeof detail, string | undefined>>;
      // @ts-expect-error field lookups stay restricted to the values shape
      getValues('missing');
      return enabled;
    },
    'rows.#.note': getValues => {
      const selected = getValues('rows.#.selected');
      type _selected = Expect<Equal<typeof selected, boolean>>;
      return selected;
    },
  });
  type _result = Expect<Equal<typeof result, Values>>;

  // @ts-expect-error condition keys must be paths in the values object
  pruneHiddenFields(values, {
    missing: () => false,
  });
  const wrongConditions = {
    detail: (getValues: GetValues<{ enabled: number; detail?: string }>) =>
      getValues('enabled') > 0,
  };
  // @ts-expect-error condition dependencies must match the values' field types
  pruneHiddenFields(values, wrongConditions);
}

function pruneGenericValues<T extends FieldValues>(
  values: T,
  conditions: FieldConditions<T>
) {
  const result = pruneHiddenFields(values, conditions);
  type _result = Expect<Equal<typeof result, T>>;
}

function pruneRejectsInvalidGetterConditions(
  getValues: UseFormGetValues<{ enabled: boolean; detail?: string }>
) {
  // @ts-expect-error an invalid getter condition cannot fall through to the values overload
  pruneHiddenFields(getValues, { missing: () => false });
}

function pruneInterfaceValues() {
  interface Values {
    enabled: boolean;
    detail?: string;
  }
  const values: Values = { enabled: true, detail: 'keep' };
  const result = pruneHiddenFields(values, {
    detail: getValues => getValues('enabled'),
  });
  type _result = Expect<Equal<typeof result, Values>>;
}

function rejectsRootArrays(
  values: { visible: boolean; note?: string }[],
  getValues: UseFormGetValues<{ visible: boolean; note?: string }[]>
) {
  // @ts-expect-error array fields must be nested inside a form object
  pruneHiddenFields(values, {});
  // @ts-expect-error root-array getters are unsupported too
  pruneHiddenFields(getValues, {});
  // @ts-expect-error root wildcard conditions are unsupported
  const rootConditions: FieldConditions<typeof values> = {
    '#.note': () => false,
  };
  useConditionalForm<typeof values>({
    // @ts-expect-error root arrays cannot be conditional-form inputs
    conditions: {},
    resolver: zodResolver(
      z.array(z.object({ visible: z.boolean(), note: z.string().optional() }))
    ),
    defaultValues: [],
  });
}

function inferredTransformedSchema() {
  const schema = z.object({
    count: z.string().transform(Number),
    note: z.string().optional(),
  });
  const form = useConditionalForm({
    conditions: {},
    resolver: zodResolver(schema),
    defaultValues: { count: '' },
  });

  const values = form.getValues();
  type _input = Expect<Equal<typeof values, z.input<typeof schema>>>;
  form.register('note');
  form.handleSubmit(data => {
    type _output = Expect<Equal<typeof data, z.output<typeof schema>>>;
  });
  // @ts-expect-error unknown input fields must not be accepted
  form.register('missing');
}

function rejectsUnrelatedResolverInput() {
  const schema = z.object({ unrelated: z.number() }).transform(() => ({ count: 0 }));
  useConditionalForm<{ count: string }, unknown, { count: number }>({
    conditions: {},
    // @ts-expect-error matching output does not make an unrelated input safe
    resolver: zodResolver(schema),
    defaultValues: { count: '' },
  });
}

function defaultsAndInlineConditions() {
  const schema = z.object({
    count: z.string().transform(Number),
    note: z.string().default(''),
  });
  const form = useConditionalForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    conditions: {
      note: getValues => {
        const count = getValues('count');
        type _countIsString = Expect<Equal<typeof count, string>>;
        return count.length > 0;
      },
    },
    defaultValues: { count: '' },
  });
  const values = form.getValues();
  type _input = Expect<Equal<typeof values, z.input<typeof schema>>>;
  form.handleSubmit(data => {
    type _output = Expect<Equal<typeof data, z.output<typeof schema>>>;
  });
}

function rawResolverKeepsInput() {
  const schema = z.object({ count: z.string().transform(Number) });
  const form = useConditionalForm({
    conditions: {},
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: { count: '' },
  });
  form.handleSubmit(data => {
    type _output = Expect<Equal<typeof data, { count: string }>>;
  });
}

function customContextAndResolver() {
  type Input = { count: string; note?: string };
  type Context = { multiplier: number };
  type Output = { count: number };
  const resolver: Resolver<Input, Context, Output> = (values, context) => ({
    values: { count: Number(values.count) * (context?.multiplier ?? 1) },
    errors: {},
  });
  const form = useConditionalForm({
    resolver,
    conditions: { note: getValues => getValues('count') !== '' },
    context: { multiplier: 2 },
    defaultValues: { count: '' },
  });
  const values = form.getValues();
  type _input = Expect<Equal<typeof values, Input>>;
  form.handleSubmit(data => {
    type _output = Expect<Equal<typeof data, Output>>;
  });
  useCondition(['note'], { note: () => false }, form.getValues, form.control);

  const nativeForm = useForm<Input, Context, Output>({ resolver });
  useCondition(
    ['note'],
    { note: () => false },
    nativeForm.getValues,
    nativeForm.control
  );
}

function rejectsInvalidConfiguration() {
  // @ts-expect-error a resolver is required
  useConditionalForm({ conditions: {}, defaultValues: { count: '' } });
  // @ts-expect-error default values are required
  useConditionalForm<{ count: string }>({
    conditions: {},
    resolver: zodResolver(z.object({ count: z.string() })),
  });

  useConditionalForm<{ count: string }, unknown, { count: number }>({
    conditions: {},
    // @ts-expect-error the resolver must produce the declared output
    resolver: zodResolver(z.object({ count: z.string() })),
    defaultValues: { count: '' },
  });
}

function nestedPathValues(
  getValues: GetValues<{
    settings?: { enabled: boolean };
    groups: ({ details?: { count: number } } | undefined)[];
  }>,
  path: 'settings.enabled' | 'groups.#.details.count'
) {
  type Input = {
    settings?: { enabled: boolean };
    groups: ({ details?: { count: number } } | undefined)[];
  };
  const enabled = getValues('settings.enabled');
  type _optionalObject = Expect<
    Equal<typeof enabled, FieldPathValue<Input, 'settings.enabled'>>
  >;
  const count = getValues('groups.#.details.count');
  type _optionalArrayItem = Expect<
    Equal<typeof count, FieldPathValue<Input, `groups.${number}.details.count`>>
  >;
  const group = getValues('groups.#');
  type _wholeRowLookup = Expect<
    Equal<typeof group, FieldPathValue<Input, `groups.${number}`>>
  >;
  const [tupleGroup] = getValues(['groups.#', 'settings.enabled']);
  type _wholeRowTupleLookup = Expect<Equal<typeof tupleGroup, typeof group>>;
  const value = getValues(path);
  type _unionLookup = Expect<
    Equal<
      typeof value,
      FieldPathValue<Input, 'settings.enabled' | `groups.${number}.details.count`>
    >
  >;
  const values = getValues([path, 'groups.#']);
  type _unionTupleLookup = Expect<Equal<typeof values, [typeof value, typeof group]>>;
  type _nestedWildcard = Expect<
    Equal<
      FieldConditionPath<{ 'groups.#.entries.#.detail': () => boolean }>,
      `groups.${number}.entries.${number}.detail`
    >
  >;
}

function arrayConditionTargets() {
  type Input = {
    groups?: {
      enabled: boolean;
      note?: string;
      entries: { detail?: string }[];
      codes: { '0': string };
    }[];
    tags: string[];
    pair: [{ note: string }, { note: string }];
  };
  const allowed = {
    groups: () => true,
    'groups.#.note': getValues => getValues('groups.#')?.enabled === true,
    'groups.0.note': () => true,
    'groups.#.entries.#.detail': () => true,
    'groups.#.codes.0': () => true,
    'pair.0.note': () => true,
  } satisfies FieldConditions<Input>;

  const badWildcard = {
    // @ts-expect-error conditions cannot target whole array items
    'groups.#': () => false,
  } satisfies FieldConditions<Input>;
  const badIndex = {
    // @ts-expect-error numeric array-item targets are also unsupported
    'groups.0': () => false,
  } satisfies FieldConditions<Input>;
  const badNestedWildcard = {
    // @ts-expect-error nested whole-array-item targets are unsupported
    'groups.#.entries.#': () => false,
  } satisfies FieldConditions<Input>;
  const badNestedIndex = {
    // @ts-expect-error nested numeric array-item targets are unsupported
    'groups.#.entries.0': () => false,
  } satisfies FieldConditions<Input>;
  const badPrimitiveItem = {
    // @ts-expect-error primitive array items cannot be condition targets either
    'tags.0': () => false,
  } satisfies FieldConditions<Input>;
  const badTupleItem = {
    // @ts-expect-error tuple items cannot be condition targets
    'pair.0': () => false,
  } satisfies FieldConditions<Input>;
}

function largeNestedConditions() {
  type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  type Entry = Partial<Record<`field${Digit | 10 | 11}`, string>> & {
    detail?: string;
    children?: { flag: boolean; note?: string }[];
  };
  type Input = Record<
    `group${0 | 1 | 2 | 3 | 4}${Digit}`,
    {
      enabled: boolean;
      details: { title: string; note?: string };
      entries: Entry[];
    }
  >;
  const conditions = {
    'group00.entries.#.detail': getValues => getValues('group00.enabled'),
  } satisfies FieldConditions<Input>;
  type _target = Expect<
    Equal<FieldConditionPath<typeof conditions>, `group00.entries.${number}.detail`>
  >;
}

function legacyPolymorphicResolver(
  resolver: <Input extends FieldValues, Context>(
    values: Input,
    context: Context | undefined,
    options: ResolverOptions<Input>
  ) => Promise<ResolverResult<Input>>
) {
  const form = useConditionalForm<BlankFormSchema>({
    resolver,
    conditions,
    defaultValues: { caterer: null, guests: [{ name: '', age: null }] },
  });
  form.handleSubmit(data => {
    type _legacyOutputRemainsInput = Expect<Equal<typeof data, BlankFormSchema>>;
  });
  useCondition(['guests.0.wine'], conditions, form.getValues, form.control);
}
