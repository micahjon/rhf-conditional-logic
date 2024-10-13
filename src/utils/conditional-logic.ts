import { FieldPath, FieldValues, UseFormGetValues } from 'react-hook-form';
import { objectKeys } from 'ts-extras';
import {
  FieldConditionPath,
  FieldConditions,
  FieldPathPlusHash,
  GetValues,
} from '../types';
import { hashIndexRegex, integerIndexRegex } from './regex';
import {
  getConditionKeyWithHashThatMatchesPath,
  swapOutHashesInFieldPath,
} from './field-name-paths';

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
  // Whenever a user looks up a value in a conditional logic function, we track
  // its field name as a depedency of the conditional field
  const dependencies: Set<FieldPath<TFieldValues>> = new Set();
  function getDependencyValue<
    TFieldName extends FieldPath<TFieldValues>,
    TFieldNames extends FieldPath<TFieldValues>[],
  >(fieldOrFields: TFieldName | readonly [...TFieldNames]) {
    if (!fieldOrFields) {
      throw new Error('Please pass getValues a field name or array of field names');
    }
    if (Array.isArray(fieldOrFields)) {
      for (const field of fieldOrFields) {
        dependencies.add(field);
      }
    } else {
      dependencies.add(fieldOrFields as TFieldName);
    }
    // @ts-expect-error Unfortunately not sure why this type isn't lining up :(
    return getValues(fieldOrFields);
  }

  // For each field the user requested, determine whether it should be visible (and
  // included in form data) or not. As we evaluate these conditions, we track
  // depedencies
  const formFieldVisibility = getConditionalLogic(
    formFieldPaths,
    conditions,
    getDependencyValue
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
  // All condition keys that are generic (have # to match any index)
  const conditionKeysWithHashes = objectKeys(conditions).filter(key =>
    hashIndexRegex.test(key)
  ) as (keyof TFieldConditions & string)[];

  return formFieldPaths.map((path): boolean => {
    if (path in conditions) {
      // Found condition matching this field exactly
      return conditions[path as keyof typeof conditions]!(getValues);
    }
    if (conditionKeysWithHashes.length && integerIndexRegex.test(path)) {
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
        return conditions[validConditionKey](modifiedGetValues);
      }
    }

    // Unable to get conditional logic for this path. Don't hide the field in the UI,
    // but show the developer a warning. They should already have a type error.
    console.warn(`Missing conditional logic for "${path}"`);
    return true;
  }) as { [Index in keyof TFieldNamesParam]: boolean };
}
