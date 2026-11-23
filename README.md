# Conditional Logic for React Hook Forms

A tiny library for defining which fields to show, using those rules in your components, and removing hidden values before validation and submission.

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

  Hidden fields keep their editing values with RHF's default `shouldUnregister: false`, but don't block validation or get submitted.

- Use `useCondition()` (similar to `useWatch()`) to check if one or more conditional fields should be visible.

  ```ts
  const [showOtherCaterer] = useCondition(['otherCaterer'], conditions, getValues, control);
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

The examples use Zod and `@hookform/resolvers`, installed separately. See [Compatibility](#compatibility) for supported versions.

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

// All conditional logic goes in one typed object
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

  // Updates when the selected caterer changes
  const [showOtherCaterer] = useCondition(['otherCaterer'], conditions, getValues, control);

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
        {showOtherCaterer && <input {...register('otherCaterer')} />}
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

  // Updates when this guest's age changes
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

Use dot-separated paths for nested fields and `#` for array indices, including nested arrays. To remove a row, use `useFieldArray().remove(index)` rather than a condition on the whole row.

Hidden values are removed before schema validation. Defaults and transforms still run, so a schema default can add a hidden field back to the submitted data.

See the [working demo](tests-e2e/mock-form) for a complete form with nullable selections, field errors, and adding/removing guests.

_Curious about the backstory of this library? Check out my article on [Type-Safe Conditional Logic in React Hook Forms + Zod](https://micahjon.com/2023/form-validation-with-zod/)._

## Input and output types

Your form may need to hold values that aren't valid for submission yet. For example, a caterer can start at `null` but must be selected before submitting. `BlankFormSchema` describes the editing values; `FormSchema` describes the validated submission.

```ts
// nullable-form.ts
import { zodResolver } from '@hookform/resolvers/zod';
import { useConditionalForm } from 'rhf-conditional-logic';
import { z } from 'zod';

const selection = z.enum(['Elephants Catering', 'Delta BBQ', 'Other'], {
  message: 'Please select a caterer',
});
const schema = z.object({ caterer: selection.nullable().pipe(selection) });
type BlankFormSchema = z.input<typeof schema>; // caterer can be null
type FormSchema = z.output<typeof schema>; // caterer cannot be null
const defaultValues: BlankFormSchema = { caterer: null };

export function useCatererForm() {
  return useConditionalForm({
    conditions: {},
    resolver: zodResolver(schema),
    defaultValues,
  });
}
```

The `.pipe(selection)` step rejects `null` on submission. Use `FieldConditions<BlankFormSchema>` for conditions, since they read the editing values.

### Generics and form context

With typed defaults and a resolver, `useConditionalForm()` can usually infer both types, as above. Give defaults their full editing type so TypeScript knows `caterer` can hold more than `null`.

If you need explicit types, use `useConditionalForm<BlankFormSchema, unknown, FormSchema>(...)`. Replace `unknown` with your resolver-context type if you use one. Passing only `<BlankFormSchema>` makes the submission type `BlankFormSchema` too.

`useFormContext()` cannot infer types from its parent `FormProvider`. If editing and submission types differ, use `useFormContext<BlankFormSchema, unknown, FormSchema>()`, or define a reusable hook from your form hook's return type:

```ts
// caterer-form-context.ts
import { useFormContext } from 'react-hook-form';
import { useCatererForm } from './nullable-form';

export const useCatererFormContext: () => ReturnType<typeof useCatererForm> =
  useFormContext;
```

Nested components can then call `useCatererFormContext()` under the matching `FormProvider`, without generics. When editing and submission types are the same, `useFormContext<FormSchema>()` is enough, as in the getting-started example.

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

`pruneHiddenFields(getValues, conditions)` also works. Neither form changes the original values or runs schema validation.

## Compatibility

Each library release lists its supported React Hook Form versions in `peerDependencies`, which npm normally checks during installation.

| Library version | React Hook Form |
| --- | --- |
| `0.1.2` (current npm release) | `^7.0.0` |
| `0.2.0` (unreleased) | `^7.55.0` |

The examples for different editing/submission types and `pruneHiddenFields(values, conditions)` require the upcoming `0.2.0` release.

The `0.2.0` examples use Zod `3.25.76` or `4` with `@hookform/resolvers` `5.2.2+`, installed separately. Zod 4 requires TypeScript `5.5+` with `strict` enabled.

## Future improvements

- Update `useCondition()` signature to allow for single field (instead of array).
- Update `useCondition()` to use `useFormContext()` and allow for optionally passing fewer parameters to it.
