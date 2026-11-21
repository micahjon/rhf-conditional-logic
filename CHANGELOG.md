# Changelog / Releases

## [Unreleased]

### Modern React Hook Form and Zod compatibility

Support modern RHF resolver types with either Zod 3 or Zod 4 ([micahjon/rhf-conditional-logic#9](https://github.com/micahjon/rhf-conditional-logic/issues/9)).

- **Breaking:** `react-hook-form` peer dependency is now `^7.55.0` (was `^7.0.0`).
- `useConditionalForm<Input, Context, Output>()` and `useCondition()` preserve RHF's distinct editing-input and parsed-output types. Existing single-generic forms still default output to input.
- With modern resolvers, editing values must match the schema's input type. The README and demo show nullable editing values with nonnullable submission output.
- Conditional path values follow the installed RHF version, including optional-parent and array-item types. Compatibility is tested across RHF 7.55/7.92 and Zod 3/4.

### Smaller improvements

- `pruneHiddenFields(values, conditions)` accepts a plain values object, in addition to RHF's getter, for nonmutating draft/autosave pruning.
- Improve performance when pruning many hidden fields and matching wildcard conditions, and reduce type-checking work for large nested forms.
- Fix pre-registration/reset validation to use RHF's resolver snapshot, without discarding parsed defaults or transforms. Absent targets are skipped, and internal guard reads no longer become watched UI dependencies.
- **Breaking:** whole-array-item condition targets (`guests.#`, `guests.0`) are rejected; use `useFieldArray().remove(index)` for row removal. Within-row conditions and whole-row dependency reads remain supported. Form roots must be objects with named array fields, not arrays themselves.

## [0.1.2] - 2024-10-12

- Improve type-safety of `useCondition([...paths], conditions, getValues, control)` hook by narrowing `paths` to only field paths associated with `conditions`, not any field path associated with the form.
  This improves editor autocompletion and type safety.
- If a path is ever provided to `useCondition()` that is is not able to find a condition for, log a warning in the console.
  This should always be accompanied by a type error (above), but is a good safeguard so that `useCondition()` never fails silently.

## [0.1.1] - 2024-07-14

_No changes in functionality._

- Fix NextJS import error ([`Module not found: Default condition should be last one`](https://github.com/micahjon/rhf-conditional-logic/issues/1)) by tweaking `package.json`'s "extends" property.

## [0.1.0] - 2023-12-29

First stable release! No functionality changes.

- Publish JS to NPM without minification to make debugging easier downstream.

## [0.0.3-alpha.1] - 2023-11-10

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
