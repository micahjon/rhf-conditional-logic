/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BrowserNativeObject,
  FieldValues,
  IsEqual,
  Path,
  PathValue,
  Primitive,
} from 'react-hook-form';

/**
 * OVERVIEW
 *
 * The path types used in this project are based on
 * React Hook Form. However, we make a few modifications
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
 *
 * - Distinguish readable paths from condition targets: whole array items
 *   can be dependencies, but only fields within them can be targets.
 *
 * - All modified React Hook Form types & their derivatives are suffixed
 *   with "CL" to distinguish them from the originals
 *
 */

/**
 * ADDITION: Map of field names to field conditions (functions that accept
 * getValues() and return a boolean). Array items can be read by conditions
 * but cannot be condition targets.
 */
export type FieldConditions<TFieldValues extends FieldValues> = Partial<
  Record<PathCL<TFieldValues, true>, (getValue: GetValues<TFieldValues>) => boolean>
> &
  (TFieldValues extends ReadonlyArray<unknown> ? never : unknown);

/**
 * All the form field paths that have conditional logic associated with them
 * Converts "parent.#.child" to "parent.${number}.child"
 */
export type FieldConditionPath<T> = {
  [K in keyof T]: K extends string ? ReplaceHashesWithNumbers<K> : never;
}[keyof T];

type ReplaceHashesWithNumbers<T extends string> =
  T extends `${infer Start}.${infer Rest}`
    ? `${Start extends '#' ? number : Start}.${ReplaceHashesWithNumbers<Rest>}`
    : T extends '#'
    ? `${number}`
    : T;

/**
 * MODIFICATION: GetValues is derived from UseFormGetValues
 *
 * Keep RHF's named-field and field-array overloads, but require field names
 * so we can track dependencies and watch those fields to re-evaluate conditions.
 * Unlike RHF's getter, its paths also accept "#" wildcard indices.
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
  <TFieldName extends FieldPathCL<TFieldValues>>(
    name: TFieldName
  ): FieldPathValueCL<TFieldValues, TFieldName>;
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
  <TFieldNames extends FieldPathCL<TFieldValues>[]>(
    names: readonly [...TFieldNames]
  ): [...FieldPathValuesCL<TFieldValues, TFieldNames>];
};

/**
 * Export our custom version of FieldPath that allows for hashes
 */
export type FieldPathPlusHash<TFieldValues extends FieldValues> = PathCL<TFieldValues>;

// ADDITION: RHF allows whole-item paths. Exclude those leaves only when
// generating condition targets; numeric object properties remain valid targets.
type PathLeafCL<
  K extends string | number,
  TConditionTarget extends boolean,
  TArrayItem extends boolean,
> = TConditionTarget extends true ? (TArrayItem extends true ? never : `${K}`) : `${K}`;

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
 * See {@link PathCL}
 */
type PathImplCL<
  K extends string | number,
  V,
  TraversedTypes,
  TConditionTarget extends boolean,
  TArrayItem extends boolean,
> = V extends Primitive | BrowserNativeObject
  ? PathLeafCL<K, TConditionTarget, TArrayItem>
  : // Check so that we don't recurse into the same type
  // by ensuring that the types are mutually assignable
  // mutually required to avoid false positives of subtypes
  true extends AnyIsEqual<TraversedTypes, V>
  ? PathLeafCL<K, TConditionTarget, TArrayItem>
  : K extends number
  ?
      | PathLeafCL<K, TConditionTarget, TArrayItem>
      | `${K}.${PathInternalCL<V, TraversedTypes | V, TConditionTarget>}`
      // MODIFICATION: RHF only generates numeric indices. Add "#" branches
      // for the current array index, retaining whole-row reads but not targets.
      | (TConditionTarget extends true ? never : '#')
      | `#.${PathInternalCL<V, TraversedTypes | V, TConditionTarget>}`
  :
      | PathLeafCL<K, TConditionTarget, TArrayItem>
      | `${K}.${PathInternalCL<V, TraversedTypes | V, TConditionTarget>}`;

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
 * MODIFICATION: RHF's PathValue does not understand "#". Normalize all wildcard
 * indices (including a terminal "parent.#") before delegating to RHF so optional
 * ancestors and other path-value semantics follow the installed RHF version.
 * Select matching native paths instead of intersecting path unions, which
 * multiplies type-checking work on large forms with many getter calls.
 */
export type PathValueCL<T, P extends PathCL<T> | ArrayPath<T>> = PathValue<
  T,
  Extract<ReplaceHashesWithNumbers<P>, Path<T>>
>;

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
export type IsTuple<T extends ReadonlyArray<any>> = number extends T['length']
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
export type TupleKeys<T extends ReadonlyArray<any>> = Exclude<keyof T, keyof any[]>;

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
 * MODIFICATION: Carry the condition-target mode through recursion and identify
 * array/tuple items separately from object properties when constructing leaves.
 *
 * See {@link PathCL}
 */
type PathInternalCL<
  T,
  TraversedTypes,
  TConditionTarget extends boolean,
> = T extends ReadonlyArray<infer V>
  ? IsTuple<T> extends true
    ? {
        [K in TupleKeys<T>]-?: PathImplCL<
          K & string,
          T[K],
          TraversedTypes,
          TConditionTarget,
          true
        >;
      }[TupleKeys<T>]
    : PathImplCL<ArrayKey, V, TraversedTypes, TConditionTarget, true>
  : {
      [K in keyof T]-?: PathImplCL<
        K & string,
        T[K],
        TraversedTypes,
        TConditionTarget,
        false
      >;
    }[keyof T];

/**
 * Type which eagerly collects all paths through a type
 * @typeParam T - type which should be introspected
 * @example
 * ```
 * Path<{foo: {bar: string}}> = 'foo' | 'foo.bar'
 * ```
 *
 * MODIFICATION: TConditionTarget selects target paths without bare array items.
 * The default retains all readable paths, including "#" wildcard indices.
 */
// We want to explode the union type and process each individually
// so assignable types don't leak onto the stack from the base.
export type PathCL<T, TConditionTarget extends boolean = false> = T extends any
  ? PathInternalCL<T, T, TConditionTarget>
  : never;

/**
 * See {@link PathCL}
 */
export type FieldPathCL<TFieldValues extends FieldValues> = PathCL<TFieldValues>;

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
 * See {@link PathValueCL}
 */
export type FieldPathValueCL<
  TFieldValues extends FieldValues,
  TFieldPath extends FieldPathCL<TFieldValues>,
> = PathValueCL<TFieldValues, TFieldPath>;

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
export type FieldPathValuesCL<
  TFieldValues extends FieldValues,
  TPath extends FieldPathCL<TFieldValues>[] | readonly FieldPathCL<TFieldValues>[],
  // eslint-disable-next-line @typescript-eslint/ban-types
> = {} & {
  [K in keyof TPath]: FieldPathValueCL<
    TFieldValues,
    TPath[K] & FieldPathCL<TFieldValues>
  >;
};
