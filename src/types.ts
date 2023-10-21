/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BrowserNativeObject,
  FieldValues,
  IsEqual,
  Primitive,
} from "react-hook-form";

/**
 * OVERVIEW
 *
 * The vast majority of the types used in this project are from
 * React Hook Form verbatum. However, we make a few modificaitons
 * & additions:
 *
 * - Define FieldConditions, the type for the object where the library
 *   consumer defines all conditional logic (keys are field name paths,
 *   values are functions that return a boolean value: show/hide)
 *
 * - Define GetValues, a less permissive version of UseFormGetValues
 *   that forces you to pass one or more field names so that we can
 *   track exactly which fields a condition depends on and only
 *   recompute the condition when necessary
 *
 * - Tweak some types to allow subbing in a hash (#) for an index
 *   in a path. The hash acts like a wildcard index, matching the
 *   "current" index of the array item being looked up.
 */

/**
 * Map of field names to field conditions (functions that accept a getValues()
 * function and return a boolean)
 */
export type FieldConditions<TFieldValues extends FieldValues> = Partial<
  Record<
    FieldPathPlusHash<TFieldValues>,
    (getValue: GetValues<TFieldValues>) => boolean
  >
>;

/**
 * GetValues is derived from UseFormGetValues
 *
 * GetValues has an identical type signature except it does not accept the
 * no-parameters option. You must always pass it something b/c it
 * keeps track of what is passed as conditional logic dependencies, so we
 * can watch these fields to re-evaluate conditional logic
 */
export type GetValues<TFieldValues extends FieldValues> = {
  /**
   * Get a single field value.
   *
   * @remarks
   * [API](https://react-hook-form.com/docs/useform/getvalues) • [Demo](https://codesandbox.io/s/react-hook-form-v7-ts-getvalues-txsfg)
   *
   * @param name - the path name to the form field value.
   *
   * @returns the single field value
   */
  <TFieldName extends FieldPath<TFieldValues>>(
    name: TFieldName
  ): FieldPathValue<TFieldValues, TFieldName>;
  /**
   * Get an array of field values.
   *
   * @remarks
   * [API](https://react-hook-form.com/docs/useform/getvalues) • [Demo](https://codesandbox.io/s/react-hook-form-v7-ts-getvalues-txsfg)
   *
   * @param names - an array of field names
   *
   * @returns An array of field values
   */
  <TFieldNames extends FieldPath<TFieldValues>[]>(
    names: readonly [...TFieldNames]
  ): [...FieldPathValues<TFieldValues, TFieldNames>];
};

/**
 * Export our custom version of FieldPath that allows for hashes
 */
export type FieldPathPlusHash<TFieldValues extends FieldValues> =
  Path<TFieldValues>;

/**
 * Helper type for recursively constructing paths through a type.
 * This actually constructs the strings and recurses into nested
 * object types.
 *
 * MODIFICATION: Allow "#" to stand in for "0/1/2", etc as an array index
 * The # matches the "current" array index, allowing the user to define a
 * single condition function that checks values from other siblings at the
 * same index.
 *
 * For instance, imagine a form where we ask for a list of guests and
 * only want to show the wine selection question if they're over 21:
 * const conditions = {
 *   "guests.#.wine": (getValues) => getValues("guests.#.age") >= 21
 * }
 *
 * The alternative would be to define "guests.0.wine", "guests.1.wine", etc.
 * for every possible guest! Or you could treat "guests.0.wine" as we're
 * treating "guests.#.wine", but then there wouldn't be an easy way to target
 * only the first guest.
 *
 * See {@link Path}
 */
type PathImpl<K extends string | number, V, TraversedTypes> = V extends
  | Primitive
  | BrowserNativeObject
  ? `${K}`
  : // Check so that we don't recurse into the same type
  // by ensuring that the types are mutually assignable
  // mutually required to avoid false positives of subtypes
  true extends AnyIsEqual<TraversedTypes, V>
  ? `${K}`
  : K extends number
  ?
      | `${K}`
      | `${K}.${PathInternal<V, TraversedTypes | V>}`
      // Note: this is a departure from React Hook Form's types. We allow
      // user to use the hash to mean "the current index", so they can
      // define a single condition for all possible indices in an array.
      | `#`
      | `#.${PathInternal<V, TraversedTypes | V>}`
  : `${K}` | `${K}.${PathInternal<V, TraversedTypes | V>}`;

/**
 * Type to evaluate the type which the given path points to.
 * @typeParam T - deeply nested type which is indexed by the path
 * @typeParam P - path into the deeply nested type
 * @example
 * ```
 * PathValue<{foo: {bar: string}}, 'foo.bar'> = string
 * PathValue<[number, string], '1'> = string
 * ```
 *
 * MODIFICATION: Allow "#" to stand in for an index, so that if a user
 * uses a path with a hash, this doesn't resolve to never.
 * Add conditions both for "#.child" and "parent.#"
 */
export type PathValue<T, P extends Path<T> | ArrayPath<T>> = T extends any
  ? P extends `${infer K}.${infer R}`
    ? K extends keyof T
      ? R extends Path<T[K]>
        ? PathValue<T[K], R>
        : never
      : K extends `${ArrayKey}` | "#" // Treat hash as an array index
      ? T extends ReadonlyArray<infer V>
        ? PathValue<V, R & Path<V>>
        : never
      : never
    : P extends keyof T
    ? T[P]
    : P extends `${ArrayKey}` | "#" // Treat hash as an array index
    ? T extends ReadonlyArray<infer V>
      ? V
      : never
    : never
  : never;

//
//
// -------------------------- Nothing more to see here -----------------------------
//
// Everything past this point was copied verbatum from React Hook Forms and is only
// included b/c it is not exported from React Hook Forms and is needed to get the
// above types to work correctly.
//
// ----------------------------------------------------------------------------------
//
//

//
// Copied from src/types/utils.ts
//

/**
 * Checks whether the type is any
 * See {@link https://stackoverflow.com/a/49928360/3406963}
 * @typeParam T - type which may be any
 * ```
 * IsAny<any> = true
 * IsAny<string> = false
 * ```
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

//
// Copied from src/types/common.ts
//

/**
 * Type to query whether an array type T is a tuple type.
 * @typeParam T - type which may be an array or tuple
 * @example
 * ```
 * IsTuple<[number]> = true
 * IsTuple<number[]> = false
 * ```
 */
export type IsTuple<T extends ReadonlyArray<any>> = number extends T["length"]
  ? false
  : true;

/**
 * Type which can be used to index an array or tuple type.
 */
export type ArrayKey = number;

/**
  
  /**
   * Type which given a tuple type returns its own keys, i.e. only its indices.
   * @typeParam T - tuple type
   * @example
   * ```
   * TupleKeys<[number, string]> = '0' | '1'
   * ```
   */
export type TupleKeys<T extends ReadonlyArray<any>> = Exclude<
  keyof T,
  keyof any[]
>;

//
// Copied from src/types/eager.ts
//

/**
 * Helper function to break apart T1 and check if any are equal to T2
 *
 * See {@link IsEqual}
 */
type AnyIsEqual<T1, T2> = T1 extends T2
  ? IsEqual<T1, T2> extends true
    ? true
    : never
  : never;

/**
 * Helper type for recursively constructing paths through a type.
 * This obscures the internal type param TraversedTypes from exported contract.
 *
 * See {@link Path}
 */
type PathInternal<T, TraversedTypes = T> = T extends ReadonlyArray<infer V>
  ? IsTuple<T> extends true
    ? {
        [K in TupleKeys<T>]-?: PathImpl<K & string, T[K], TraversedTypes>;
      }[TupleKeys<T>]
    : PathImpl<ArrayKey, V, TraversedTypes>
  : {
      [K in keyof T]-?: PathImpl<K & string, T[K], TraversedTypes>;
    }[keyof T];

/**
 * Type which eagerly collects all paths through a type
 * @typeParam T - type which should be introspected
 * @example
 * ```
 * Path<{foo: {bar: string}}> = 'foo' | 'foo.bar'
 * ```
 */
// We want to explode the union type and process each individually
// so assignable types don't leak onto the stack from the base.
export type Path<T> = T extends any ? PathInternal<T> : never;

/**
 * See {@link Path}
 */
export type FieldPath<TFieldValues extends FieldValues> = Path<TFieldValues>;

/**
 * Helper type for recursively constructing paths through a type.
 * This actually constructs the strings and recurses into nested
 * object types.
 *
 * See {@link ArrayPath}
 */
type ArrayPathImpl<K extends string | number, V, TraversedTypes> = V extends
  | Primitive
  | BrowserNativeObject
  ? IsAny<V> extends true
    ? string
    : never
  : V extends ReadonlyArray<infer U>
  ? U extends Primitive | BrowserNativeObject
    ? IsAny<V> extends true
      ? string
      : never
    : // Check so that we don't recurse into the same type
    // by ensuring that the types are mutually assignable
    // mutually required to avoid false positives of subtypes
    true extends AnyIsEqual<TraversedTypes, V>
    ? never
    : `${K}` | `${K}.${ArrayPathInternal<V, TraversedTypes | V>}`
  : true extends AnyIsEqual<TraversedTypes, V>
  ? never
  : `${K}.${ArrayPathInternal<V, TraversedTypes | V>}`;

/**
 * Helper type for recursively constructing paths through a type.
 * This obscures the internal type param TraversedTypes from exported contract.
 *
 * See {@link ArrayPath}
 */
type ArrayPathInternal<T, TraversedTypes = T> = T extends ReadonlyArray<infer V>
  ? IsTuple<T> extends true
    ? {
        [K in TupleKeys<T>]-?: ArrayPathImpl<K & string, T[K], TraversedTypes>;
      }[TupleKeys<T>]
    : ArrayPathImpl<ArrayKey, V, TraversedTypes>
  : {
      [K in keyof T]-?: ArrayPathImpl<K & string, T[K], TraversedTypes>;
    }[keyof T];

/**
 * Type which eagerly collects all paths through a type which point to an array
 * type.
 * @typeParam T - type which should be introspected.
 * @example
 * ```
 * Path<{foo: {bar: string[], baz: number[]}}> = 'foo.bar' | 'foo.baz'
 * ```
 */
// We want to explode the union type and process each individually
// so assignable types don't leak onto the stack from the base.
export type ArrayPath<T> = T extends any ? ArrayPathInternal<T> : never;

/**
 * See {@link PathValue}
 */
export type FieldPathValue<
  TFieldValues extends FieldValues,
  TFieldPath extends FieldPath<TFieldValues>,
> = PathValue<TFieldValues, TFieldPath>;

/**
 * Type to evaluate the type which the given paths point to.
 * @typeParam TFieldValues - field values which are indexed by the paths
 * @typeParam TPath        - paths into the deeply nested field values
 * @example
 * ```
 * FieldPathValues<{foo: {bar: string}}, ['foo', 'foo.bar']>
 *   = [{bar: string}, string]
 * ```
 */
export type FieldPathValues<
  TFieldValues extends FieldValues,
  TPath extends FieldPath<TFieldValues>[] | readonly FieldPath<TFieldValues>[],
  // eslint-disable-next-line @typescript-eslint/ban-types
> = {} & {
  [K in keyof TPath]: FieldPathValue<
    TFieldValues,
    TPath[K] & FieldPath<TFieldValues>
  >;
};
