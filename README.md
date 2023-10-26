# Conditional Logic for React Hook Forms

A tiny library that makes it easy to define conditional logic in one place and expose it in components for conditional rendering, smarter validation & only submitting visible values.

## Features

- Define conditional logic (whether to show/hide field) in a single typed config object
- `useConditionalLogic()` hook returns visibility of passed fields and automatically detects & watches dependencies with `useWatch()`
- `pruneHiddenFields()` util lets you remove hidden fields from `getValues()` before validation and after submission.
  - This lets you track hidden field values (`shouldUnregister = false`) for a great UX but not have to worry about hidden fields showing up in `errors` or preventing submission entirely.
- Supports defining a single condition for all items in an array using `#` as a wildcard index
- Fully typed with Typescript, get autocompletion & validation based on your Zod schema (or whatever validator you're using)

## Show me the code:

...

## Future improvements

Update `useConditionalLogic` signature to allow for single field (instead of array). Maybe add provider option so we only have one param?
