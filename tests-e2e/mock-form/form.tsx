import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import {
  FieldErrors,
  FieldPath,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";
import { pruneHiddenFields, useConditionalLogic } from "../../src";
import {
  BlankFormSchema,
  FormSchema,
  conditions,
  formSchema,
  getDefaultValues,
} from "./schema";
import { get } from "lodash-es";

export function Form() {
  const formMethods = useForm<BlankFormSchema>({
    defaultValues: getDefaultValues(),
    resolver: function (_: BlankFormSchema, ...otherArgs) {
      const prunedValues = pruneHiddenFields(conditions, formMethods.getValues);
      return zodResolver(formSchema)(prunedValues, ...otherArgs);
    },
  });
  const {
    handleSubmit,
    getValues,
    control,
    register,
    formState: { errors },
    reset,
  } = formMethods;

  const onSubmit = (data: BlankFormSchema) => {
    // At this point, data has passed validation
    console.log("Successfully submitted", data as FormSchema);
    reset(getDefaultValues());
  };

  const [showOtherCaterer] = useConditionalLogic(
    ["otherCaterer"],
    conditions,
    getValues,
    control
  );

  const {
    fields: guestFields,
    append: appendGuest,
    remove: removeGuestByIndex,
  } = useFieldArray({
    control,
    name: "guests",
  });

  // console.log({ errors });

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <label>
          Your Name
          <input type="text" {...register("contactName")} />
          <FieldError errors={errors} path="contactName" />
        </label>
        <label>
          Email
          <input type="email" {...register("contactEmail")} />
          <FieldError errors={errors} path="contactEmail" />
        </label>
        <fieldset>
          <legend>Select Caterer</legend>
          <label>
            <input
              {...register("caterer")}
              type="radio"
              value="Elephants Catering"
            />
            Elephants Catering
          </label>
          <label>
            <input {...register("caterer")} type="radio" value="Delta BBQ" />
            Delta BBQ
          </label>
          <label>
            <input {...register("caterer")} type="radio" value="Other" />
            Other
          </label>
          <FieldError errors={errors} path="caterer" />
        </fieldset>
        {showOtherCaterer && (
          <label>
            Other Caterer
            <input type="text" {...register("otherCaterer")} />
            <FieldError errors={errors} path="otherCaterer" />
          </label>
        )}
        <fieldset>
          <label>List Guests</label>
          {guestFields.map((field, i) => (
            <Guest
              key={field.id}
              index={i}
              remove={() => removeGuestByIndex(i)}
            />
          ))}
          <button
            onClick={() => appendGuest(getDefaultValues().guests[0])}
            style={{
              height: "36px",
              width: "auto",
              padding: "4px 1rem",
              float: "right",
            }}
          >
            Add Guest
          </button>
          <FieldError errors={errors} path="guests" />
        </fieldset>

        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}

function Guest({ index, remove }: { index: number; remove: () => void }) {
  const {
    register,
    getValues,
    control,
    formState: { errors },
  } = useFormContext<BlankFormSchema>();
  const prefix = `guests.${index}` as const;

  const [showWineField] = useConditionalLogic(
    [`${prefix}.wine`],
    conditions,
    getValues,
    control
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "1rem 1rem 0",
        marginBottom: "1rem",
      }}
    >
      <label>
        Guest Name
        <input type="text" {...register(`${prefix}.name`)} />
        <FieldError errors={errors} path={`${prefix}.name`} />
      </label>
      <fieldset>
        <legend>Select Age</legend>
        <label>
          <input {...register(`${prefix}.age`)} type="radio" value="0-5" />
          Under 5
        </label>
        <label>
          <input {...register(`${prefix}.age`)} type="radio" value="6-12" />6 -
          12
        </label>
        <label>
          <input {...register(`${prefix}.age`)} type="radio" value="13-20" />
          13 - 20
        </label>
        <label>
          <input {...register(`${prefix}.age`)} type="radio" value="21+" />
          21+
        </label>
        <FieldError errors={errors} path={`${prefix}.age`} />
      </fieldset>
      {showWineField && (
        <fieldset>
          <legend>Wine Pairing</legend>
          <label>
            <input {...register(`${prefix}.wine`)} type="radio" value="Red" />
            Red
          </label>
          <label>
            <input {...register(`${prefix}.wine`)} type="radio" value="White" />
            White
          </label>
          <label>
            <input
              {...register(`${prefix}.wine`)}
              type="radio"
              value="Rosé on ice"
            />
            Rosé on ice
          </label>
          <label>
            <input {...register(`${prefix}.wine`)} type="radio" value="None" />
            None
          </label>
          <FieldError errors={errors} path={`${prefix}.wine`} />
        </fieldset>
      )}
      <button
        onClick={() => remove()}
        style={{
          height: "36px",
          width: "auto",
          padding: "4px 1rem",
        }}
      >
        Remove Guest
      </button>
    </div>
  );
}

function FieldError({
  errors,
  path,
}: {
  errors: FieldErrors<BlankFormSchema>;
  path: FieldPath<BlankFormSchema>;
}) {
  const error = get(errors, path);
  if (error && error.type && error.message) {
    return (
      <div role="alert" style={{ color: "crimson", marginBottom: "1rem" }}>
        {error.message}
      </div>
    );
  }
  return null;
}
