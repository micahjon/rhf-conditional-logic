# Changelog / Releases

## [0.0.3-alpha.0] - 2023-11-10

- Add `useConditionalForm()` hook (drop-in replacement for `useForm()` that calls `pruneHiddenFields()` before validation)
- Rename `useConditionalLogic()` -> `useCondition()` for brevity
- Swap order of `pruneHiddenFields()` parameters (pass `getValues` first)

## [0.0.2-alpha.3] - 2023-11-08

- Fix bug where deeply nested values weren't pruned
- Fix bug where pruning within an array converted the array to an object
- Stop recommending pruning of valid form submission (since pruning already happens in resolver before validation)

## [0.0.2-alpha.0] - 2023-11-02

- Have `useConditionalLogic()` return array (same as React Hook Form's `useWatch()`), instead of an object. Makes it easier to destructure deeply nested conditional values, e.g.

**Before**

```ts
// Before (returns object)
const { 'guests.0.wine': showWineField } = useConditionalLogic(
  ['guests.0.wine'],
  conditions,
  getValues,
  control
);

// After (returns array)
const [showWineField] = useConditionalLogic(
  ['guests.0.wine'],
  conditions,
  getValues,
  control
);
```

## [0.0.1-alpha.4] - 2023-10-31

- Stop using `JSON.stringify()` to clone form data before pruning, since form data may not be fully serializable (user could stick anything in there).
  Instead, use new `deleteByPathWithoutMutation()` utility to prune values without mutation

## [0.0.1-alpha.1] - 2023-10-31

First working draft of library!

- Expose `useConditionalLogic()` hook
- Expose `pruneHiddenFields()` util
