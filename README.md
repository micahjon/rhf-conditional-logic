# Conditional Logic for React Hook Forms

A tiny library that makes it easy to define conditional logic in one place, expose it in components for conditional rendering, and ignore hidden field values during validation & submission.

[Features](#features)&emsp;[Getting Started](#getting-started)&emsp;[Changelog](https://github.com/micahjon/rhf-conditional-logic/blob/main/CHANGELOG.md)

[![npm](https://img.shields.io/npm/v/rhf-conditional-logic.svg)](https://www.npmjs.com/package/rhf-conditional-logic)
[![minzip](https://img.shields.io/bundlephobia/minzip/rhf-conditional-logic.svg)](https://www.npmjs.com/package/rhf-conditional-logic)
![types](https://img.shields.io/badge/types-typescript-blueviolet)

## Features

- Define conditional logic (whether to show/hide fields) in a single typed object, e.g.
  ```ts
  const conditions = {
    // Show "Other Caterer" field if "Other" option is selected
    otherCaterer: getValues => getValues('caterer') === 'Other',
    // Show wine pairing options for guests over 21
    ['guests.#.wine']: getValues => getValues('guests.#.age') >= 21,
  };
  ```
  - A single condition can be defined for all indices in an array by using `#` as a wildcard (e.g. `guests.#.email`)
- `useConditionalForm()` drop-in replacement for `useForm()` prunes hidden field values before validation.
  This way you can track hidden field values with `shouldUnregister = false` for better UX but not have to worry about hidden fields showing up in `errors` or preventing submission entirely.

  ```ts
  const { register } = useConditionalForm<FormSchema>({
    conditions,
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(),
  });
  ```

- `useCondition()` hook returns visibility of passed field(s) and automatically re-renders when dependencies change using `useWatch()`

  ```ts
  // showField is a boolean
  const [showField] = useCondition(['fieldName'], conditions, getValues, control);
  ```

- Fully typed with Typescript! Get autocompletion & validation based on your Zod schema (or whatever validator you're using)

## Getting Started

```bash
npm i rhf-conditional-logic
```

```tsx
import { useForm } from 'react-hook-form';
import {
  useConditionalForm,
  useCondition,
  FieldConditions,
} from 'rhf-conditional-logic';

// Define form schema with conditional fields optional, since hidden field values
// will not be included in the form submission
const formSchema = z.object({
  caterer: z.enum(['Elephants Catering', 'Delta BBQ', 'Other']),
  otherCaterer: z.string().min(2).optional(), // Shown if "caterer" is "Other"
  guests: z.array(
    z.object({
      age: z.number(),
      wine: z.enum(['Red', 'White', 'Rosé on ice', 'None']).optional(), // Show if 21+
    })
  ),
});
type FormSchema = z.infer<typeof formSchema>;

// All conditional logic goes in a single declarative object
// { path.to.field: (getValues) => boolean }
const conditions: FieldConditions<FormSchema> = {
  // Show "Other Caterer" if "Other" option is selected
  otherCaterer: getValues => getValues('caterer') === 'Other',
  // Show "Wine" options for guests over 21
  // Note: "#" wildcard stands-in for "current" array index
  ['guests.#.wine']: getValues => getValues('guests.#.age') >= 21,
};

export function Form() {
  // useConditionalForm() wraps useForm() and prunes hidden field values
  // before validation / submission
  const { getValues, control } = useConditionalForm<FormSchema>({
    conditions, // Your conditional logic definition goes here
    resolver: zodResolver(formSchema), // Required
    defaultValues: getDefaultValues(), // Required
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

## Future improvements

Update `useCondition` signature to allow for single field (instead of array). Maybe add FormContext awareness so we only have one param?
