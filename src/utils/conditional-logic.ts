import {
  FieldPath,
  FieldPathValue,
  FieldPathValues,
  FieldValues,
  UseFormGetValues,
} from 'react-hook-form';
import { objectKeys } from 'ts-extras';
import {
  FieldConditionPath,
  FieldConditions,
  FieldPathPlusHash,
  GetValues,
} from '../types';
import { hashIndexRegex, integerIndexRegex, integerRegex } from './regex';
import {
  getConditionKeyWithHashThatMatchesPath,
  swapOutHashesInFieldPath,
} from './field-name-paths';

export function assertValidConditionTargets<TFieldValues extends FieldValues>(
  formFieldPaths: readonly string[],
  conditionKeys: readonly string[],
  getUntrackedValues: GetValues<TFieldValues>
) {
  // Numeric keys can also be object properties, so inspect the parent.
  const arrayItemTarget =
    conditionKeys.find(key => key.endsWith('.#')) ??
    formFieldPaths.find(path => {
      const separator = path.lastIndexOf('.');
      return (
        separator >= 0 &&
        integerRegex.test(path.slice(separator + 1)) &&
        Array.isArray(
          getUntrackedValues(
            path.slice(0, separator) as FieldPathPlusHash<TFieldValues>
          )
        )
      );
    });
  if (arrayItemTarget) {
    throw new Error(
      `Conditions cannot target entire array items ("${arrayItemTarget}"). Target a field within the item or remove the row with useFieldArray().`
    );
  }
}

// Utility to compute conditional logic for one or more fields and track dependencies
export function getConditionalLogicWithDependencies<
  TFieldValues extends FieldValues,
  TFieldConditions extends FieldConditions<TFieldValues>,
  TConditionPath extends FieldConditionPath<TFieldConditions>,
>(
  formFieldPaths: readonly [...TConditionPath[]],
  conditions: TFieldConditions,
  getValues: UseFormGetValues<TFieldValues>
) {
  const conditionKeys = objectKeys(conditions);
  assertValidConditionTargets(formFieldPaths, conditionKeys, getValues);
  // Whenever a user looks up a value in a conditional logic function, we track
  // its field name as a depedency of the conditional field
  const dependencies: Set<FieldPath<TFieldValues>> = new Set();
  function getDependencyValue<TFieldName extends FieldPath<TFieldValues>>(
    field: TFieldName
  ): FieldPathValue<TFieldValues, TFieldName>;
  function getDependencyValue<TFieldNames extends FieldPath<TFieldValues>[]>(
    fields: readonly [...TFieldNames]
  ): [...FieldPathValues<TFieldValues, TFieldNames>];
  function getDependencyValue(
    fieldOrFields: FieldPath<TFieldValues> | readonly FieldPath<TFieldValues>[]
  ) {
    if (!fieldOrFields) {
      throw new Error('Please pass getValues a field name or array of field names');
    }
    if (typeof fieldOrFields === 'string') {
      dependencies.add(fieldOrFields);
      return getValues(fieldOrFields);
    }
    for (const field of fieldOrFields) {
      dependencies.add(field);
    }
    return getValues(fieldOrFields);
  }

  // For each field the user requested, determine whether it should be visible (and
  // included in form data) or not. As we evaluate these conditions, we track
  // depedencies
  const formFieldVisibility = evaluateConditionalLogic(
    formFieldPaths,
    conditions,
    getDependencyValue,
    conditionKeys
  );

  return { formFieldVisibility, dependencies };
}

// Utility to compute conditional logic for a subset of fields
export function getConditionalLogic<
  TFieldValues extends FieldValues,
  TFieldNames extends FieldPath<TFieldValues>[],
  TFieldNamesParam extends readonly [...TFieldNames],
  TFieldConditions extends FieldConditions<TFieldValues>,
  TConditionPath extends FieldConditionPath<TFieldConditions>,
>(
  formFieldPaths: readonly [...TConditionPath[]],
  conditions: TFieldConditions,
  getValues: GetValues<TFieldValues>
) {
  const conditionKeys = objectKeys(conditions);
  assertValidConditionTargets(formFieldPaths, conditionKeys, getValues);
  return evaluateConditionalLogic<
    TFieldValues,
    TFieldNames,
    TFieldNamesParam,
    TFieldConditions,
    TConditionPath
  >(formFieldPaths, conditions, getValues, conditionKeys);
}

/**
 * Return visibility flags in the same order as the requested concrete field paths.
 * Exact conditions take precedence over wildcard conditions; this does not prune values.
 * Condition reads use getValues so callers can track dependencies. Callers validate
 * targets first with an untracked getter, so guards never become UI dependencies.
 */
export function evaluateConditionalLogic<
  TFieldValues extends FieldValues,
  TFieldNames extends FieldPath<TFieldValues>[],
  TFieldNamesParam extends readonly [...TFieldNames],
  TFieldConditions extends FieldConditions<TFieldValues>,
  TConditionPath extends FieldConditionPath<TFieldConditions>,
>(
  formFieldPaths: readonly [...TConditionPath[]],
  conditions: TFieldConditions,
  getValues: GetValues<TFieldValues>,
  conditionKeys: readonly string[]
) {
  // Prepare wildcard segments once, and only if an exact condition wasn't found.
  let conditionKeysWithHashes: { key: string; parts: string[] }[] | undefined;

  return formFieldPaths.map((path): boolean => {
    if (path in conditions) {
      // Found condition matching this field exactly
      return conditions[path as keyof typeof conditions]!(getValues);
    }
    if (integerIndexRegex.test(path)) {
      conditionKeysWithHashes ??= conditionKeys
        .filter(key => hashIndexRegex.test(key))
        .map(key => ({ key, parts: key.split('.') }));
      const conditionKey = getConditionKeyWithHashThatMatchesPath(
        path,
        conditionKeysWithHashes
      );
      if (conditionKey) {
        // Found matching condition key with hashes
        // Before calling getValues(), swap out any indices corresponding to the
        // hashes with the indices of the passed field path. This allows child
        // fields to do conditional logic based on their parent's values.
        const modifiedGetValues = <TFieldName extends FieldPathPlusHash<TFieldValues>>(
          withHashes: TFieldName | TFieldName[]
        ) => {
          return Array.isArray(withHashes)
            ? getValues(
                withHashes.map(field =>
                  swapOutHashesInFieldPath(field, path)
                ) as TFieldName[]
              )
            : getValues(swapOutHashesInFieldPath(withHashes, path) as TFieldName);
        };
        // @ts-expect-error Oof, not sure why this isn't getting typed
        return conditions[conditionKey](modifiedGetValues);
      }
    }

    // Unable to get conditional logic for this path. Don't hide the field in the UI,
    // but show the developer a warning. They should already have a type error.
    console.warn(`Missing RHF conditional logic for "${path}"`);
    return true;
  }) as { [Index in keyof TFieldNamesParam]: boolean };
}
