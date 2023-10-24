import {
  Control,
  FieldPath,
  FieldValues,
  UseFormGetValues,
  useWatch,
} from "react-hook-form";
import { objectKeys } from "ts-extras";
import { FieldConditions } from "./types";
import {
  getConditionalLogic,
  getConditionalLogicWithDependencies,
} from "./utils/conditional-logic";
import { deleteByPath } from "./utils/delete-by-path";

//
// Public API
//

/**
 * Hook to expose conditional logic to RHF form components
 * @param fieldNamePaths One or more field name paths (e.g. "guests.1.winePairing")
 * @param conditions The field conditions object with all conditional logic for this form
 * @param getValues React Hook Form's getValues() utility function
 * @param control React Hook Form's control object
 * @returns A map of each field name path to a boolean (show or hide)
 */
export function useConditionalLogic<
  TFieldValues extends FieldValues,
  TFieldNames extends FieldPath<TFieldValues>[],
>(
  fieldNamePaths: readonly [...TFieldNames],
  conditions: FieldConditions<TFieldValues>,
  getValues: UseFormGetValues<TFieldValues>,
  control: Control<TFieldValues>
) {
  const { formFieldVisibility, dependencies } =
    getConditionalLogicWithDependencies(fieldNamePaths, conditions, getValues);
  useWatch({ control, name: Array.from(dependencies) });
  return formFieldVisibility;
}

/**
 * Prune hidden fields from form values
 * This way invalid values in hidden fields don't cause validation errors
 * and hidden fields are not included in final form submission
 * @param conditions The field conditions object with all conditional logic for this form
 * @param getValues React Hook Form's getValues() utility function
 * @returns All field values except those hidden by conditional logic
 */
export function pruneHiddenFields<
  TFieldValues extends FieldValues,
  TFieldNames extends FieldPath<TFieldValues>[],
>(
  conditions: FieldConditions<TFieldValues>,
  getValues: UseFormGetValues<TFieldValues>
) {
  // Run all conditional logic and get results
  const formFieldVisibility = getConditionalLogic(
    objectKeys(conditions) as TFieldNames,
    conditions,
    getValues
  );

  // Remove hidden values
  const values = JSON.parse(JSON.stringify(getValues()));
  for (const fieldName in formFieldVisibility) {
    const isHidden =
      formFieldVisibility[fieldName as TFieldNames[number]] === false;
    if (isHidden) {
      deleteByPath(values, fieldName);
    }
  }
  return values;
}

//
// Additional utilities
//

export { getConditionalLogic, getConditionalLogicWithDependencies };
