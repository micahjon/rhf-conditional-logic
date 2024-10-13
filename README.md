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

- Use `useConditionalForm()` (a drop-in replacement for `useForm()`) to prune hidden field values before validation:

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

- **Fully typed** with Typescript! Get autocompletion & validation based on your Zod schema (or whatever validator you're using)

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

Totally up to you, but I find it cleaner to stick schemas in one file and components in another, e.g.

```tsx
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
  // Note: "#" wildcard stands-in for "current" array index
  ['guests.#.wine']: getValues => getValues('guests.#.age') >= 21,
} satisfies FieldConditions<FormSchema>;
```

```tsx
// Form.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useConditionalForm, useCondition } from 'rhf-conditional-logic';
import { FormSchema, conditions, formSchema } from './form-schema';

export function Form() {
  // useConditionalForm() wraps useForm() and prunes hidden field values
  // before validation / submission
  const { getValues, control } = useConditionalForm<FormSchema>({
    conditions, // Your conditional logic definition goes here
    resolver: zodResolver(formSchema), // Required
    defaultValues, // Required
  });

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
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* ... form fields go here */}
      {guestFields.map((field, i) => (
        <Guest key={field.id} index={i} />
      ))}
    </form>
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

  return <fieldset>...</fieldset>;
}
```

_Curious about the backstory of this library? Check out my article on [Type-Safe Conditional Logic in React Hook Forms + Zod](https://micahjon.com/2023/form-validation-with-zod/)._

## Future improvements

- Update `useCondition()` signature to allow for single field (instead of array).
- Update `useCondition()` to use `useFormContext()` and allow for optionally passing fewer parameters to it.
