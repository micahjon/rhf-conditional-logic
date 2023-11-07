# Conditional Logic for React Hook Forms

A tiny library that makes it easy to define conditional logic in one place and expose it in components for conditional rendering, smarter validation & only submitting visible values.

[![npm](https://img.shields.io/npm/v/rhf-conditional-logic.svg)](https://www.npmjs.com/package/rhf-conditional-logic)
[![minzip](https://img.shields.io/bundlephobia/minzip/rhf-conditional-logic.svg)](https://www.npmjs.com/package/rhf-conditional-logic)
![types](https://img.shields.io/badge/types-typescript-blueviolet)

## Features

- Define conditional logic (whether to show/hide field) in a single typed config object
- `useConditionalLogic()` hook returns visibility of passed fields and automatically detects & watches dependencies with `useWatch()`
- `pruneHiddenFields()` util lets you remove hidden fields from `getValues()` before validation and after submission.
  - This lets you track hidden field values (`shouldUnregister = false`) for a great UX but not have to worry about hidden fields showing up in `errors` or preventing submission entirely.
- Supports defining a single condition for each item in an array using `#` as a wildcard index
- Fully typed with Typescript, get autocompletion & validation based on your Zod schema (or whatever validator you're using)

## Getting Started

```bash
npm i rhf-conditional-logic
```

```tsx
import { useForm } from "react-hook-form";
import {
  useConditionalLogic,
  pruneHiddenFields,
  FieldConditions,
} from "rhf-conditional-logic";

// Define form schema with conditional fields optional, so that these
// field values can be pruned when hidden (pre-validation, pre-submission)
const formSchema = z.object({
  caterer: z.enum(["Elephants Catering", "Delta BBQ", "Other"]),
  otherCaterer: z.string().min(2).optional(), // Shown if "caterer" is "Other"
  guests: z.array(
    z.object({
      age: z.number(),
      wine: z.enum(["Red", "White", "Rosé on ice", "None"]).optional(), // Show if 21+
    })
  ),
});
type FormSchema = z.infer<typeof formSchema>;

// All conditional logic goes in a single declarative object
const conditions: FieldConditions<FormSchema> = {
  // Show "Other Caterer" if "Other" option is selected
  otherCaterer: getValues => getValues("caterer") === "Other",
  // Show "Wine" options for guests over 21
  // Note: "#" stands in for "current" index
  ["guests.#.wine"]: getValues => getValues("guests.#.age") >= 21,
};

export function Form() {
  const { getValues, control } = useForm<FormSchema>({
    defaultValues: getDefaultValues(),
    resolver: function (_: FormSchema, ...otherArgs) {
      // Remove values associated with hidden fields so they don't interfere with validation
      const prunedValues = pruneHiddenFields(conditions, getValues);
      return zodResolver(formSchema)(prunedValues, ...otherArgs);
    },
  });

  // "showCaterer" boolean will update based on "caterer" value
  const [showCaterer] = useConditionalLogic(
    ["otherCaterer"],
    conditions,
    getValues,
    control
  );

  const { fields: guestFields, append: appendGuest } = useFieldArray({
    control,
    name: "guests",
  });

  const onSubmit = () => {
    const validVisibleFields = pruneHiddenFields(conditions, getValues);
    // Do something with pruned submission...
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
  const [showWineField] = useConditionalLogic(
    [`guests.${index}.wine`],
    conditions,
    getValues,
    control
  );

  return <fieldset>...</fieldset>;
}
```

## Future improvements

Update `useConditionalLogic` signature to allow for single field (instead of array). Maybe add provider option so we only have one param?
