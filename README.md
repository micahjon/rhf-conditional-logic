# Conditional Logic for React Hook Forms

A tiny library that makes it easy to define conditional logic in one place, expose it in components for conditional rendering, and prune hidden field values before validation & submission.

[Features](#features)&emsp;[Getting Started](#getting-started)&emsp;[Changelog](https://github.com/micahjon/rhf-conditional-logic/blob/main/CHANGELOG.md)

[![npm](https://img.shields.io/npm/v/rhf-conditional-logic.svg)](https://www.npmjs.com/package/rhf-conditional-logic)
[![minzip](https://img.shields.io/bundlephobia/minzip/rhf-conditional-logic.svg)](https://www.npmjs.com/package/rhf-conditional-logic)
![types](https://img.shields.io/badge/types-typescript-blueviolet)

## Features

- Define conditional logic (whether to show/hide fields) in a single typed object:

  ```ts
  const conditions = {
    // Show "Other Caterer" field if "Other" option is selected
    otherCaterer: getValues => getValues('caterer') === 'Other',
  } satisfies FieldConditions<FormSchema>;
  ```

- Use `useConditionalForm()` (a drop-in replacement for `useForm()`) to prune hidden field values before validation & submission:

  ```ts
  const { register } = useConditionalForm<FormSchema>({
    conditions,
    resolver: zodResolver(formSchema),
    defaultValues: {...},
  });
  ```

  This way you can track hidden field values with `shouldUnregister = false` but don't have to worry about them showing up in `errors` and preventing submission, or even worse, being submitted when the user didn't intend to submit them!

- Use `useCondition()` (similar to `useWatch()`) to check if one or more conditional fields should be visible.

  ```ts
  const [showOtherOption] = useCondition(['otherCaterer'], conditions, getValues, control);
  ```

- **Fully typed** with TypeScript! Get autocompletion & validation based on your Zod schema (or whatever validator you're using).

- You can even define conditional logic for every item in an array (e.g. rendered via `useFieldArray`) with `#` wildcard that stands in for "current index":

  ```ts
  const conditions = {
    // Show wine pairing options for each guest over 21
    ['guests.#.wine']: getValues => getValues('guests.#.age') >= 21,
  };
  ```

## Getting Started

```bash
npm i rhf-conditional-logic
```

The examples use Zod and `@hookform/resolvers`, installed separately. See [Compatibility](#compatibility) for release-specific guidance.

Totally up to you, but I find it cleaner to stick schemas in one file and components in another, e.g.

```ts
// form-schema.ts
import { z } from 'zod';
import { FieldConditions } from 'rhf-conditional-logic';

// Define form schema with conditional fields optional, since hidden field values
// will not be included in the form submission
export const formSchema = z.object({
  caterer: z.enum(['Elephants Catering', 'Delta BBQ', 'Other']),
  otherCaterer: z.string().min(2).optional(), // Shown if "caterer" is "Other"
  guests: z.array(
    z.object({
      age: z.number(),
      wine: z.enum(['Red', 'White', 'Rosé on ice', 'None']).optional(), // Show if 21+
    })
  ),
});
export type FormSchema = z.infer<typeof formSchema>;

// All conditional logic goes in a single declarative object
// { path.to.field: (getValues) => boolean }
export const conditions = {
  // Show "Other Caterer" if "Other" option is selected
  otherCaterer: getValues => getValues('caterer') === 'Other',
  // Show "Wine" options for guests over 21
  // Note: "#" wildcard stands in for "current" array index
  ['guests.#.wine']: getValues => getValues('guests.#.age') >= 21,
} satisfies FieldConditions<FormSchema>;

export const defaultValues: FormSchema = {
  caterer: 'Elephants Catering',
  guests: [{ age: 0 }],
};
```

```tsx
// Form.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useFieldArray, useFormContext } from 'react-hook-form';
import { useConditionalForm, useCondition } from 'rhf-conditional-logic';
import { FormSchema, conditions, defaultValues, formSchema } from './form-schema';

export function Form() {
  // useConditionalForm() wraps useForm() and prunes hidden field values
  // before validation / submission
  const methods = useConditionalForm<FormSchema>({
    conditions, // Your conditional logic definition goes here
    resolver: zodResolver(formSchema), // Required
    defaultValues, // Required
  });
  const { register, handleSubmit, getValues, control } = methods;

  // "showCaterer" boolean will update based on "caterer" value
  const [showCaterer] = useCondition(['otherCaterer'], conditions, getValues, control);

  const { fields: guestFields, append: appendGuest } = useFieldArray({
    control,
    name: 'guests',
  });

  const onSubmit = (validVisibleFields: FormSchema) => {
    // Do something with pruned & validated form submission!
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* ... other form fields go here */}
        {showCaterer && <input {...register('otherCaterer')} />}
        {guestFields.map((field, i) => (
          <Guest key={field.id} index={i} />
        ))}
        <button type="button" onClick={() => appendGuest({ age: 0 })}>Add guest</button>
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}

function Guest({ index }: { index: number }) {
  const { register, getValues, control } = useFormContext<FormSchema>();

  // "showWineField" boolean will update based on "age" value
  // for this particular field array index
  const [showWineField] = useCondition(
    [`guests.${index}.wine`],
    conditions,
    getValues,
    control
  );

  return (
    <fieldset>
      <input type="number" {...register(`guests.${index}.age`, { valueAsNumber: true })} />
      {showWineField && <input {...register(`guests.${index}.wine`)} />}
    </fieldset>
  );
}
```

Conditions target nested dot-separated field paths, including fields within array rows. Nested `#` wildcards and whole-row dependency reads (e.g. `getValues('guests.#')`) are supported. To remove an entire row, use `useFieldArray().remove(index)`, not a condition on `guests.#` or `guests.0`.

Pruning does not clear editing values with RHF's default `shouldUnregister: false`. Resolver defaults/transforms still run and may add omitted values back; avoid defaults on hidden fields unless that submitted value is intentional.

See the [working demo](tests-e2e/mock-form) for a complete form with nullable selections, field errors, and adding/removing guests.

_Curious about the backstory of this library? Check out my article on [Type-Safe Conditional Logic in React Hook Forms + Zod](https://micahjon.com/2023/form-validation-with-zod/)._

## Input and output types

Like RHF, `useConditionalForm()` distinguishes editing **Input** from parsed **Output**. Defaults, conditions and `getValues()` use input; successful submission callbacks receive output. These types can often be inferred from your resolver and typed defaults. For example, a selection can start at null while editing but be required on submission:

```ts
// nullable-form.ts
import { zodResolver } from '@hookform/resolvers/zod';
import { useConditionalForm } from 'rhf-conditional-logic';
import { z } from 'zod';

const selection = z.enum(['Elephants Catering', 'Delta BBQ', 'Other'], {
  message: 'Please select a caterer',
});
const schema = z.object({ caterer: selection.nullable().pipe(selection) });
type Input = z.input<typeof schema>; // caterer can be null
type Output = z.output<typeof schema>; // caterer cannot be null
const defaultValues: Input = { caterer: null };

export function useCatererForm() {
  return useConditionalForm({
    conditions: {},
    resolver: zodResolver(schema),
    defaultValues,
  });
}
```

Use `FieldConditions<Input>` for conditions. The pipe above is for simple enums; do not apply a transforming schema twice.

### Generics and form context

You don't need explicit generics when the resolver and defaults provide enough type information, as above. Annotating `defaultValues: Input` avoids inferring a nullable field as only `null`; `satisfies Input` checks the value but does not widen it.

When inference isn't sufficient, pass `useConditionalForm<Input, Context, Output>(...)`, using `unknown` if you don't use resolver context. Passing only `<Input>` defaults output to input rather than inferring it from the resolver.

`useFormContext()` cannot infer types from its parent `FormProvider`. If input and output differ, use `useFormContext<Input, Context, Output>()`, or define a form-specific hook that reuses the inferred form type:

```ts
// caterer-form-context.ts
import { useFormContext } from 'react-hook-form';
import { useCatererForm } from './nullable-form';

export const useCatererFormContext: () => ReturnType<typeof useCatererForm> =
  useFormContext;
```

Nested components can then call `useCatererFormContext()` without generics. They must still be under the matching `FormProvider`; the type annotation does not check the provider relationship. When input and output are the same, `useFormContext<FormSchema>()` is sufficient, as in the getting-started example.

## Pruning values outside a form

For drafts or autosave, pass values directly to `pruneHiddenFields()`:

```ts
// prune-draft.ts
import { pruneHiddenFields } from 'rhf-conditional-logic';
import { FormSchema, conditions } from './form-schema';

const draft: FormSchema = {
  caterer: 'Delta BBQ',
  otherCaterer: 'A previous selection',
  guests: [{ age: 12, wine: 'White' }],
};
const pruned = pruneHiddenFields(draft, conditions);
// { caterer: 'Delta BBQ', guests: [{ age: 12 }] }
// draft is unchanged
```

`pruneHiddenFields(getValues, conditions)` remains supported. Both forms evaluate against the original values without validation or mutation, skipping absent/undefined targets.

## Compatibility

Each library release declares its supported React Hook Form range in `peerDependencies`, which npm normally checks during installation.

| Library version | React Hook Form peer range |
| --- | --- |
| `0.1.2` (current npm release) | `^7.0.0` |
| `0.2.0` (unreleased) | `^7.55.0` |

The distinct input/output typing and plain-values pruning examples above describe the unreleased `0.2.0` changes, not the current npm release.

Zod and `@hookform/resolvers` are optional, separately installed packages, so this library's peer dependencies do not constrain their versions. The unreleased examples use Zod `3.25.76` or `4` with `@hookform/resolvers` `5.2.2+`. For Zod 4, use TypeScript `5.5+` with `strict` enabled.

## Future improvements

- Update `useCondition()` signature to allow for single field (instead of array).
- Update `useCondition()` to use `useFormContext()` and allow for optionally passing fewer parameters to it.
