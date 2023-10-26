import { z } from "zod";
import { FieldConditions } from "../../src/types";

// Setup typical Zod form schema. Conditional values must be .optional()
const guestSchema = z.object({
  name: z.string().min(2),
  age: z.enum(["0-5", "6-12", "13-20", "21+"]),
  wine: z.enum(["Red", "White", "Rosé on ice", "None"]).optional(), // Show if 21+
});
export const formSchema = z.object({
  contactName: z.string().min(2),
  contactEmail: z.string().email(),
  caterer: z.enum(["Elephants Catering", "Delta BBQ", "Other"]),
  otherCaterer: z.string().min(2).optional(), // Shown if "caterer" is "Other"
  guests: z.array(guestSchema).min(1),
});
export type FormSchema = z.infer<typeof formSchema>;

// Make enums nullable initially
const blankFormSchema = formSchema.extend({
  caterer: formSchema._def.shape().caterer.nullable(),
  guests: z
    .array(guestSchema.extend({ age: guestSchema._def.shape().age.nullable() }))
    .min(1),
});
export type BlankFormSchema = z.infer<typeof blankFormSchema>;

// Get default values for form
export const getDefaultValues = (): BlankFormSchema => ({
  contactName: "",
  contactEmail: "",
  caterer: null,
  guests: [
    {
      name: "",
      age: null,
    },
  ],
});

// Define conditional logic
export const conditions: FieldConditions<BlankFormSchema> = {
  otherCaterer: getValues => getValues("caterer") === "Other",
  ["guests.#.wine"]: getValues => getValues("guests.#.age") === "21+",
};
