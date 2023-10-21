import { FieldPath as RhfFieldPath, FieldValues } from "react-hook-form";
import { FieldPathPlusHash } from "../types";
import { hashIndexRegex, integerRegex } from "./regex";

// Given a list of condition keys with hashes, find the first one
// that matches a particular field name path
export function getConditionKeyWithHashThatMatchesPath<
  TFieldValues extends FieldValues,
  TFieldName extends RhfFieldPath<TFieldValues>,
>(
  pathWithIndices: TFieldName,
  conditionKeysWithHashes: FieldPathPlusHash<TFieldValues>[]
) {
  const pathParts = pathWithIndices.split(".");
  // If path has a numberic index, attempt to find a condition with a
  // wildcard "#" hash index
  // This is used to allow a single condition to match multiple indices
  // e.g. the same condition for every object in the array
  for (const conditionKey of conditionKeysWithHashes) {
    // For instance:
    //   path = "guest.0.name"
    //   conditionKey = "guest.#.name"
    // Could be nested:
    //   path = "house.1.cats.2"
    //   conditionKey = "house.#.cats.#"
    // And could be a mix:
    //   path = "house.1.cats.2"
    //   conditionKey = "house.0.cats.#"
    //   (target all cats in the first house only)

    // Bail if the number of path segments are different
    const conditionKeyParts = conditionKey.split(".");
    if (pathParts.length !== conditionKeyParts.length) continue;

    // Check to see if the field names & indices & hashes all line up as expected
    const conditionMatchesPath = pathParts.every((pathPart, pathPartIndex) => {
      const conditionKeyPart = conditionKeyParts[pathPartIndex];

      // An exact match
      if (pathPart === conditionKeyPart) return true;

      // Index in path matches hash in condition key
      return integerRegex.test(pathPart) && conditionKeyPart === "#";
    });
    if (conditionMatchesPath) return conditionKey;
  }

  return undefined;
}

export function swapOutHashesInFieldPath<
  TFieldValues extends FieldValues,
  TFieldNameRequested extends FieldPathPlusHash<TFieldValues>,
  TFieldNameConditional extends RhfFieldPath<TFieldValues>,
>(
  requestedFieldPath: TFieldNameRequested,
  conditionalFieldPath: TFieldNameConditional
) {
  // No hashes to replace with indices
  if (!hashIndexRegex.test(requestedFieldPath)) {
    return requestedFieldPath as RhfFieldPath<TFieldValues>;
  }

  const conditionalFieldPathParts = conditionalFieldPath.split(".");
  let hasDiverged = false;

  return requestedFieldPath
    .split(".")
    .map((requestedPart, requestedPartIndex) => {
      // Conditional field name path no longer matches requested field path. Stop searching for overlap.
      if (hasDiverged) return requestedPart;

      const conditionalPart = conditionalFieldPathParts[requestedPartIndex];

      // No corresponding conditional field part
      if (!conditionalPart) return requestedPart;

      // Paths are identical so far
      if (conditionalPart === requestedPart) return requestedPart;

      // Swap out # in requested field path with corresponding index in conditional field path
      if (requestedPart === "#" && integerRegex.test(conditionalPart)) {
        return conditionalPart;
      }

      // No longer aligned
      hasDiverged = true;
      return requestedPart;
    })
    .join(".") as RhfFieldPath<TFieldValues>;
}
