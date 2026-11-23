import { z } from 'zod';
import { FieldConditions } from '../../src/types';

const guestAgeSchema = z.enum(['0-5', '6-12', '13-20', '21+'], {
  message: 'Please select an age',
});
const catererSchema = z.enum(['Elephants Catering', 'Delta BBQ', 'Other'], {
  message: 'Please select a caterer',
});

// Setup typical Zod form schema. Conditional values must be .optional()
const guestSchema = z.object({
  name: z.string().min(2),
  age: guestAgeSchema.nullable().pipe(guestAgeSchema),
  wine: z.enum(['Red', 'White', 'Rosé on ice', 'None']).optional(), // Show if 21+
});
export const formSchema = z.object({
  contactName: z.string().min(2),
  contactEmail: z.string().email(),
  caterer: catererSchema.nullable().pipe(catererSchema),
  otherCaterer: z.string().min(2).optional(), // Shown if "caterer" is "Other"
  guests: z.array(guestSchema).min(1),
});
export type FormSchema = z.output<typeof formSchema>;
export type BlankFormSchema = z.input<typeof formSchema>;

// Get default values for form
export const getDefaultValues = (): BlankFormSchema => ({
  contactName: '',
  contactEmail: '',
  caterer: null,
  guests: [
    {
      name: '',
      age: null,
    },
  ],
});

// Define conditional logic
export const conditions = {
  otherCaterer: getValues => getValues('caterer') === 'Other',
  'guests.#.wine': getValues => getValues('guests.#.age') === '21+',
} satisfies FieldConditions<BlankFormSchema>;
