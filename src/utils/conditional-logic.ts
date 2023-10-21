import {
  FieldPath as RhfFieldPath, // Clarify that it's not our modified version
  FieldValues,
  UseFormGetValues,
} from "react-hook-form";
import { objectFromEntries, objectKeys } from "ts-extras";
import { FieldConditions, FieldPathPlusHash, GetValues } from "../types";
import { hashIndexRegex, integerIndexRegex } from "./regex";
import {
  getConditionKeyWithHashThatMatchesPath,
  swapOutHashesInFieldPath,
} from "./field-name-paths";

// Utility to compute conditional logic for one or more fields and track dependencies
export function getConditionalLogicWithDependencies<
  TFieldValues extends FieldValues,
  TFieldNames extends RhfFieldPath<TFieldValues>[],
>(
  formFieldPaths: readonly [...TFieldNames],
  conditions: FieldConditions<TFieldValues>,
  getValues: UseFormGetValues<TFieldValues>
) {
  // Whenever a user looks up a value in a conditional logic function, we track
  // its field name as a depedency of the conditional field
  const dependencies: Set<RhfFieldPath<TFieldValues>> = new Set();
  function getDependencyValue<
    TFieldName extends RhfFieldPath<TFieldValues>,
    TFieldNames extends RhfFieldPath<TFieldValues>[],
  >(fieldOrFields: TFieldName | readonly [...TFieldNames]) {
    if (!fieldOrFields) {
      throw new Error(
        "Please pass getValues a field name or array of field names"
      );
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
  TFieldNames extends RhfFieldPath<TFieldValues>[],
>(
  formFieldPaths: readonly [...TFieldNames],
  conditions: FieldConditions<TFieldValues>,
  getValues: GetValues<TFieldValues>
): Record<TFieldNames[number] & string, boolean> {
  return objectFromEntries(
    formFieldPaths.map(path => {
      let isVisible = true;

      // All condition keys that are generic (have # to match any index)
      const conditionKeysWithHashes = objectKeys(conditions).filter(key =>
        hashIndexRegex.test(key)
      ) as FieldPathPlusHash<TFieldValues>[];

      if (path in conditions) {
        // Found condition matching this field exactly
        isVisible = conditions[path as keyof typeof conditions]!(getValues);
      } else if (
        conditionKeysWithHashes.length &&
        integerIndexRegex.test(path)
      ) {
        const conditionKey = getConditionKeyWithHashThatMatchesPath(
          path,
          conditionKeysWithHashes
        );
        if (conditionKey) {
          // Found matching condition key with hashes
          // When calling getValues(), swap out any indices corresponding to the
          // hashes with the indices of the passed field path
          const modifiedGetValues = <
            TFieldName extends FieldPathPlusHash<TFieldValues>,
            TFieldNames extends FieldPathPlusHash<TFieldValues>[],
          >(
            fieldOrFields: TFieldName | readonly [...TFieldNames]
          ) => {
            const transformedFieldOrFields = Array.isArray(fieldOrFields)
              ? fieldOrFields.map(field =>
                  swapOutHashesInFieldPath(field, path)
                )
              : swapOutHashesInFieldPath(fieldOrFields as TFieldName, path);

            // @ts-expect-error Not sure why this is so hard to get Types working for :(
            return getValues(transformedFieldOrFields);
          };
          isVisible = conditions[conditionKey]!(modifiedGetValues);
        }
      }

      return [path, isVisible];
    })
  );
}
