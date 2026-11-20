import {
  Control,
  FieldValues,
  Resolver,
  UseFormGetValues,
  UseFormProps,
  UseFormReturn,
  get,
  useForm,
  useWatch,
} from 'react-hook-form';
import { objectKeys } from 'ts-extras';
import {
  FieldConditionPath,
  FieldConditions,
  FieldPathCL,
  FieldPathValueCL,
  FieldPathValuesCL,
} from './types';
import {
  getConditionalLogic,
  getConditionalLogicWithDependencies,
} from './utils/conditional-logic';
import { deleteByPathWithoutMutation } from './utils/delete-by-path';

//
// Public API
//

// Functions expose Symbol.hasInstance. This guard excludes callable values
// without conditional types that would reject generic object callers.
type NonCallableValues = { readonly [Symbol.hasInstance]?: never };

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
  TFieldConditions extends FieldConditions<TFieldValues>,
  TConditionPaths extends FieldConditionPath<TFieldConditions>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TContext = any,
  TTransformedValues = TFieldValues,
>(
  fieldNamePaths: readonly [...TConditionPaths[]],
  conditions: TFieldConditions,
  getValues: UseFormGetValues<TFieldValues>,
  control: Control<TFieldValues, TContext, TTransformedValues>
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
 * @param valuesOrGetValues Form values or React Hook Form's getValues() utility function
 * @param conditions The field conditions object with all conditional logic for this form
 * @returns All field values except those hidden by conditional logic
 */
export function pruneHiddenFields<
  TFieldValues extends FieldValues,
  TFieldConditions extends FieldConditions<TFieldValues>,
>(
  getValues: UseFormGetValues<TFieldValues>,
  conditions: TFieldConditions
): TFieldValues;
export function pruneHiddenFields<TFieldValues extends FieldValues>(
  values: TFieldValues & NonCallableValues,
  conditions: FieldConditions<TFieldValues>
): TFieldValues;
export function pruneHiddenFields<
  TFieldValues extends FieldValues,
  TFieldConditions extends FieldConditions<TFieldValues>,
>(
  valuesOrGetValues: TFieldValues | UseFormGetValues<TFieldValues>,
  conditions: TFieldConditions
): TFieldValues {
  const initialValues =
    typeof valuesOrGetValues === 'function' ? valuesOrGetValues() : valuesOrGetValues;
  if (Array.isArray(initialValues)) {
    throw new Error(
      'Form values must be an object, not a root array. Put array fields inside the form object.'
    );
  }
  const getValueAtPath = (path: string) => get(initialValues, path);

  function getSnapshotValues<TFieldName extends FieldPathCL<TFieldValues>>(
    name: TFieldName
  ): FieldPathValueCL<TFieldValues, TFieldName>;
  function getSnapshotValues<TFieldNames extends FieldPathCL<TFieldValues>[]>(
    names: readonly [...TFieldNames]
  ): [...FieldPathValuesCL<TFieldValues, TFieldNames>];
  function getSnapshotValues(names: string | readonly string[]) {
    return typeof names === 'string'
      ? getValueAtPath(names)
      : names.map(getValueAtPath);
  }

  const getValues =
    typeof valuesOrGetValues === 'function' ? valuesOrGetValues : getSnapshotValues;

  // Run all conditional logic and get results
  const fieldPathsWithHashes = objectKeys(conditions);
  let values = initialValues;

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
          const expectedArray = getValueAtPath(partsBeforeHash.join('.'));
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
    .flat() as unknown[] as FieldConditionPath<TFieldConditions>[];

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

/**
 * Drop-in replacement for useForm() that prunes hidden field values before validation
 * Only new parameter is conditions: your conditional logic definition object
 *
 * Mirrors useForm()'s <Input, Context, Output> generics, so handleSubmit()
 * receives the validated output type.
 *
 * @param props — form configuration and validation parameters.
 * @param props.conditions - Required conditional logic definitions
 * @param props.resolver - Required resolver parameter, e.g. zodResolver(schema)
 * @param props.defaultValues - Required default values parameter
 * @returns The standard useForm() return value (form methods)
 */
export function useConditionalForm<
  TFieldValues extends FieldValues = FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TContext = any,
  TTransformedValues = TFieldValues,
>(
  props: Omit<
    UseFormProps<TFieldValues, TContext, TTransformedValues>,
    'resolver' | 'defaultValues'
  > & {
    conditions: FieldConditions<TFieldValues>;
    resolver: Resolver<TFieldValues, TContext, TTransformedValues>;
    defaultValues: NonNullable<UseFormProps<TFieldValues>['defaultValues']>;
  }
): UseFormReturn<TFieldValues, TContext, TTransformedValues> {
  const { conditions, resolver, ...useFormOptions } = props;

  // Wrap the resolver to prune hidden fields before validating, so hidden
  // invalid values don't block validation or end up in the submission.
  const conditionalResolver: Resolver<TFieldValues, TContext, TTransformedValues> = (
    values,
    context,
    options
  ) => {
    const prunedValues = pruneHiddenFields(values, conditions);
    return resolver(prunedValues, context, options);
  };

  const formMethods: UseFormReturn<TFieldValues, TContext, TTransformedValues> =
    useForm<TFieldValues, TContext, TTransformedValues>({
      ...useFormOptions,
      resolver: conditionalResolver,
    });

  return formMethods;
}

//
// Additional utilities
//

export { getConditionalLogic, getConditionalLogicWithDependencies };

//
// Public types
//

export type { FieldConditions, FieldConditionPath, GetValues } from './types';
