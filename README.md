# Conditional Logic for React Hook Forms

A tiny library that makes it easy to define conditional logic in one place, expose it in components for conditional rendering, and prune hidden field values before validation & submission.

[Getting started](#getting-started)&emsp;[Array fields](#array-fields)&emsp;[Input and output types](#input-and-output-types)&emsp;[Pruning values](#pruning-values)&emsp;[Changelog](CHANGELOG.md)

[![npm](https://img.shields.io/npm/v/rhf-conditional-logic.svg)](https://www.npmjs.com/package/rhf-conditional-logic)
[![minzip](https://img.shields.io/bundlephobia/minzip/rhf-conditional-logic.svg)](https://www.npmjs.com/package/rhf-conditional-logic)
![types](https://img.shields.io/badge/types-typescript-blueviolet)

## Features

- Define visibility rules in one typed object.
- Render conditional fields with `useCondition()`, which updates when their dependencies change.
- Prune hidden values before validation and submission without clearing the user's editing values.
- Support nested arrays with `#` wildcard paths.
- Use any React Hook Form resolver, including Zod 3 and 4.

## Getting Started

```bash
npm i rhf-conditional-logic
```

Requires React Hook Form `^7.55.0`. The examples below use Zod `3.25.76` or `4` with `@hookform/resolvers` `5.2.2+`; install those separately if needed:

```bash
npm i react-hook-form @hookform/resolvers zod
```

For Zod 4, use TypeScript `5.5+` with `strict` enabled.

### Define the schema and conditions

Make conditional fields optional in your schema: hidden values are removed before the resolver validates the form.

```ts
// form-schema.ts
import { z } from 'zod';
import { type FieldConditions } from 'rhf-conditional-logic';

export const formSchema = z.object({
  caterer: z.enum(['Elephants Catering', 'Delta BBQ', 'Other']),
  otherCaterer: z.string().min(2).optional(),
  guests: z.array(
    z.object({
      age: z.number(),
      wine: z.enum(['Red', 'White', 'None']).optional(),
    })
  ),
});
export type FormSchema = z.infer<typeof formSchema>;

export const conditions = {
  otherCaterer: getValues => getValues('caterer') === 'Other',
  'guests.#.wine': getValues => getValues('guests.#.age') >= 21,
} satisfies FieldConditions<FormSchema>;

export const defaultValues: FormSchema = {
  caterer: 'Elephants Catering',
  otherCaterer: '',
  guests: [{ age: 0 }],
};
```

### Render the form

`useConditionalForm()` accepts the usual `useForm()` options plus `conditions`. Both `resolver` and `defaultValues` are required. `useCondition()` returns one visibility boolean for each requested field.

```tsx
// Form.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useFieldArray } from 'react-hook-form';
import { useConditionalForm, useCondition } from 'rhf-conditional-logic';
import { type FormSchema, conditions, defaultValues, formSchema } from './form-schema';
import { Guest } from './Guest';

export function Form() {
  const methods = useConditionalForm<FormSchema>({
    conditions,
    resolver: zodResolver(formSchema),
    defaultValues,
  });
  const { register, handleSubmit, getValues, control } = methods;
  const [showOtherOption] = useCondition(['otherCaterer'], conditions, getValues, control);
  const { fields, append } = useFieldArray({ control, name: 'guests' });

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(data => console.log(data))}>
        <label>
          Caterer
          <select {...register('caterer')}>
            <option>Elephants Catering</option>
            <option>Delta BBQ</option>
            <option>Other</option>
          </select>
        </label>
        {showOtherOption && (
          <label>
            Other caterer
            <input {...register('otherCaterer')} />
          </label>
        )}
        {fields.map((field, index) => (
          <Guest key={field.id} index={index} />
        ))}
        <button type="button" onClick={() => append({ age: 0 })}>Add guest</button>
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}
```

With RHF's default `shouldUnregister: false`, hidden inputs retain their editing values. Only the values passed to the resolver are pruned, so hidden invalid values do not block submission.

## Array fields

Use `#` in conditions to mean "the current array index". For example, `guests.#.wine` reads `guests.#.age` from the same guest. Multiple `#` segments support nested arrays.

Conditions can target fields within a row, but not an entire array item (`guests.#` or `guests.0`). Use `useFieldArray().remove(index)` to remove rows. Within a field condition, `getValues('guests.#')` can still read the current guest.

When rendering a row, pass its actual index to `useCondition()`. This child component uses the `FormProvider` from the example above:

```tsx
// Guest.tsx
import { useFormContext } from 'react-hook-form';
import { useCondition } from 'rhf-conditional-logic';
import { type FormSchema, conditions } from './form-schema';

export function Guest({ index }: { index: number }) {
  const { register, getValues, control } = useFormContext<FormSchema>();
  const [showWine] = useCondition(
    [`guests.${index}.wine`],
    conditions,
    getValues,
    control
  );

  return (
    <fieldset>
      <legend>Guest {index + 1}</legend>
      <label>
        Age
        <input type="number" {...register(`guests.${index}.age`, { valueAsNumber: true })} />
      </label>
      {showWine && (
        <label>
          Wine
          <select {...register(`guests.${index}.wine`)}>
            <option>Red</option>
            <option>White</option>
            <option>None</option>
          </select>
        </label>
      )}
    </fieldset>
  );
}
```

See the [working demo](tests-e2e/mock-form) for a complete form with nullable selections, field errors, and adding/removing guests.

## Input and output types

Use `useConditionalForm<Input, Context, Output>()` when a resolver produces a different type from the editing values. `getValues()`, defaults, conditions, and errors use **Input**; successful `handleSubmit()` callbacks receive **Output**.

For example, this enum starts at null while editing but requires a selection on submission:

```ts
// nullable-form.ts
import { zodResolver } from '@hookform/resolvers/zod';
import { useConditionalForm } from 'rhf-conditional-logic';
import { z } from 'zod';

const catererSchema = z.enum(['Elephants Catering', 'Delta BBQ', 'Other'], {
  message: 'Please select a caterer',
});
const formSchema = z.object({
  caterer: catererSchema.nullable().pipe(catererSchema),
});

type FormInput = z.input<typeof formSchema>; // caterer can be null
type FormOutput = z.output<typeof formSchema>; // caterer cannot be null

export function useCatererForm() {
  return useConditionalForm<FormInput, unknown, FormOutput>({
    conditions: {},
    resolver: zodResolver(formSchema),
    defaultValues: { caterer: null },
  });
}
```

Use `FieldConditions<FormInput>` for visibility rules and the same three generics in `useFormContext<FormInput, unknown, FormOutput>()` for nested components. Passing only `<FormInput>` defaults output to input.

With `zodResolver(schema, undefined, { raw: true })`, validation still runs, but successful `handleSubmit()` callbacks receive the pruned input rather than parsed output. Leave the output type equal to the input type.

The nullable pipe above is for simple enums; do not apply a transforming schema twice.

## Pruning values

Use `pruneHiddenFields()` directly for drafts, autosave, summaries, or other code outside a form:

```ts
// prune-draft.ts
import { pruneHiddenFields } from 'rhf-conditional-logic';
import { type FormSchema, conditions } from './form-schema';

const draft: FormSchema = {
  caterer: 'Elephants Catering',
  otherCaterer: 'A previous selection',
  guests: [{ age: 12, wine: 'White' }],
};

const pruned = pruneHiddenFields(draft, conditions);
// { caterer: 'Elephants Catering', guests: [{ age: 12 }] }
// draft is unchanged
```

You can also pass RHF's getter: `pruneHiddenFields(getValues, conditions)`. Both forms infer their types from the input, support the same conditions and wildcard paths, and leave the original values unchanged. Conditions always read the original values, before any fields are removed.

Pruning does not validate values or change their type. Resolver defaults/transforms can add fields back after pruning; avoid defaults on hidden fields unless that submitted value is intentional.

_More background: [Type-Safe Conditional Logic in React Hook Forms + Zod](https://micahjon.com/2023/form-validation-with-zod/)._
