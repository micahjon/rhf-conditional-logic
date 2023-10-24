import React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useConditionalLogic } from "../../src";
import {
  BlankFormSchema,
  FormSchema,
  conditions,
  getDefaultValues,
} from "./schema";

export function Form() {
  const {
    handleSubmit,
    getValues,
    control,
    register,
    formState: { errors },
  } = useForm<BlankFormSchema>({
    defaultValues: getDefaultValues(),
  });
  const onSubmit = data => console.log(data as FormSchema);

  // Expose on window for vitest to do type-checking
  Object.assign(window, { getValues });

  const { otherCaterer: showOtherCaterer } = useConditionalLogic(
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
    rules: { minLength: 1 },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label>
        Name
        <input type="text" {...register("contactName")} />
        {errors.contactName && <span>{errors.contactName.message}</span>}
      </label>
      <label>
        Email
        <input type="email" {...register("contactEmail")} />
        {errors.contactEmail && <span>{errors.contactEmail.message}</span>}
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
      </fieldset>
      {showOtherCaterer && (
        <label>
          Other Caterer
          <input type="text" {...register("otherCaterer")} />
          {errors.otherCaterer && <span>{errors.otherCaterer.message}</span>}
        </label>
      )}
      <fieldset>
        <label>List Guests</label>
        {guestFields.map((field, i) => {
          return <Guest key={field.id} remove={() => removeGuestByIndex(i)} />;
        })}
        <button onClick={() => appendGuest(getDefaultValues().guests[0])}>
          Add Guest
        </button>
      </fieldset>
    </form>
  );
}

function Guest({ remove }: { remove: () => void }) {
  return (
    <div>
      ...
      <button onClick={() => remove()} style={{ padding: "4px" }}>
        X
      </button>
    </div>
  );
}
