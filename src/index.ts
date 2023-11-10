import {
  Control,
  FieldPath,
  FieldValues,
  UseFormGetValues,
  UseFormProps,
  UseFormReturn,
  useForm,
  useWatch,
} from 'react-hook-form';
import { objectKeys } from 'ts-extras';
import { FieldConditions, FieldPathPlusHash } from './types';
import {
  getConditionalLogic,
  getConditionalLogicWithDependencies,
} from './utils/conditional-logic';
import { deleteByPathWithoutMutation } from './utils/delete-by-path';
import { getByPath } from './utils/get-by-path';

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
export function useCondition<
  TFieldValues extends FieldValues,
  TFieldNames extends FieldPath<TFieldValues>[],
>(
  fieldNamePaths: readonly [...TFieldNames],
  conditions: FieldConditions<TFieldValues>,
  getValues: UseFormGetValues<TFieldValues>,
  control: Control<TFieldValues>
) {
  const { formFieldVisibility, dependencies } = getConditionalLogicWithDependencies(
    fieldNamePaths,
    conditions,
    getValues
  );
  useWatch({ control, name: Array.from(dependencies) });
  return formFieldVisibility;
}

/**
 * Prune hidden fields from form values
 * This way invalid values in hidden fields don't cause validation errors
 * and hidden fields are not included in final form submission
 * @param getValues React Hook Form's getValues() utility function
 * @param conditions The field conditions object with all conditional logic for this form
 * @returns All field values except those hidden by conditional logic
 */
export function pruneHiddenFields<
  TFieldValues extends FieldValues,
  TFieldNames extends FieldPath<TFieldValues>[],
>(
  getValues: UseFormGetValues<TFieldValues>,
  conditions: FieldConditions<TFieldValues>
) {
  // Run all conditional logic and get results
  const fieldPathsWithHashes = objectKeys(
    conditions
  ) as FieldPathPlusHash<TFieldValues>[];
  let values = getValues();

  const fieldPaths = fieldPathsWithHashes
    .map(fieldPath => {
      const pathParts = fieldPath.split('.');
      if (!pathParts.includes('#')) return fieldPath;

      // Handle path containing hashes standing in for indexes by creating a
      // new path for each possible index
      const hashIndices = pathParts
        .map((part, index) => (part === '#' ? index : false))
        .filter(i => i !== false) as number[];
      let pathsToTransform: string[] = [fieldPath];
      for (const hashIndex of hashIndices) {
        // No more paths to transform. Means we've hit dead ends for every path
        if (!pathsToTransform.length) break;

        // Paths to transform after this iteration
        const nextPathsToTransform: string[] = [];

        // Swap out this hash index in ever path
        for (const path of pathsToTransform) {
          const partsBeforeHash = path.split('.').slice(0, hashIndex);
          const partsAfterHash = path.split('.').slice(hashIndex + 1);
          const expectedArray = getByPath(values)(partsBeforeHash.join('.'));
          if (Array.isArray(expectedArray)) {
            expectedArray.forEach((_, index) => {
              nextPathsToTransform.push(
                [...partsBeforeHash, index, ...partsAfterHash].join('.')
              );
            });
          }
        }
        pathsToTransform = nextPathsToTransform;
      }
      return pathsToTransform;
    })
    .flat() as TFieldNames;

  const conditionResults = getConditionalLogic(fieldPaths, conditions, getValues);

  // Remove hidden values
  fieldPaths.forEach((fieldPath, index) => {
    const isHidden = conditionResults[index] === false;
    if (isHidden) {
      values = deleteByPathWithoutMutation(values, fieldPath) as TFieldValues;
    }
  });

  return values;
}

type WithRequiredProperty<Type, Key extends keyof Type> = Type & {
  [Property in Key]-?: Type[Property];
};

/**
 * Drop-in replacement for useForm() that prunes hidden field values before validation
 * Only new parameter is conditions: your conditional logic definition object
 * @param props — form configuration and validation parameters.
 * @param props.conditions - Required conditional logic definitions
 * @param props.resolver - Required resolver parameter, e.g. zodResolver(schema)
 * @param props.defaultValues - Required default values parameter
 * @returns
 */
export function useConditionalForm<TFieldValues extends FieldValues>(
  props: WithRequiredProperty<
    UseFormProps<TFieldValues>,
    'resolver' | 'defaultValues'
  > & {
    conditions: FieldConditions<TFieldValues>;
  }
) {
  const { conditions, resolver, ...useFormOptions } = props;
  const formMethods: UseFormReturn<TFieldValues> = useForm({
    resolver: (_: TFieldValues, ...otherArgs) => {
      // Prune hidden fields before validating
      const prunedValues = pruneHiddenFields(formMethods.getValues, conditions);
      return resolver(prunedValues, ...otherArgs);
    },
    ...useFormOptions,
  });
  return formMethods;
}

//
// Additional utilities
//

export { getConditionalLogic, getConditionalLogicWithDependencies };
