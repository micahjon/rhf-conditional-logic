# Changelog / Releases

## [Unreleased]

Compatibility with modern React Hook Form and both Zod 3 and 4 ([micahjon/rhf-conditional-logic#9](https://github.com/micahjon/rhf-conditional-logic/issues/9)).

- **Breaking:** `react-hook-form` peer dependency is now `^7.55.0` (was `^7.0.0`).
- **Breaking:** conditions cannot target entire array items (`guests.#` or `guests.0`). Use `useFieldArray()` for row removal; within-row field conditions and whole-row value lookups remain supported.
- Array-item guard reads do not become watched dependencies; numeric object-key conditions only watch the values their visibility rules actually read.
- Generate condition-target paths directly instead of resolving every path's parent type, avoiding excessive type instantiation on large nested forms.
- Root-array forms are rejected instead of silently skipping their wildcard conditions; array fields inside form objects remain supported.
- `useConditionalForm()` now mirrors `useForm()`'s three generics: `useConditionalForm<TInput, TContext, TOutput>()`. Submission callbacks receive the validated output type; editing values, errors, and conditions retain the input type. Output defaults to input for existing single-generic forms.
- Resolvers retain RHF's strict input/output contract. With modern adapters, separately declared nullable blank types must match the schema's input, not just its output. The README and demo show a Zod 3/4-compatible nullable-input example.
- `useCondition()` now accepts a `control` from a form whose output type differs from its input type.
- Conditional path values delegate to installed RHF path-value types, preserving newer optional-parent/array-item semantics instead of relying on an outdated copy.
- Explicitly re-export the `FieldConditions`, `FieldConditionPath`, and `GetValues` types from the package root.
- `pruneHiddenFields(values, conditions)` now accepts a plain values object as an alternative to RHF's `getValues`, with inferred input/condition types and unchanged nonmutating pruning behavior. Existing getter calls remain supported.
- Invalid getter conditions cannot fall through to the values overload. Plain-values dependency lookups match RHF's fallback to literal dotted keys when nested values are undefined.
- Pruning uses RHF's exported `get` helper so its dependency lookups stay aligned with UI visibility.
- The resolver wrapper prunes the values provided by RHF rather than reading `getValues()`, keeping pre-mount and reset validation aligned with RHF.
- Zod raw mode returns pruned input; otherwise the resolver's parsed output is preserved, including defaults/transforms that may add fields back after pruning.
- Add compile-time API regressions, hook integration tests, and standalone pruning tests. CI covers RHF 7.55/7.92 with Zod 3/4; resolver output, raw mode, custom sync/async resolvers, context, nested wildcards, and incomplete drafts are covered.
- Reorganize the README around installation and usage examples for forms, array fields, distinct input/output types, and standalone pruning. Zod/resolver packages remain development-only dependencies.
- `npm run pub` refuses prerelease versions before building or publishing; use `npm run pub:beta` to publish a beta with its explicit dist-tag.

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
