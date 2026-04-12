import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
    title: z
      .string({
        required_error: 'Package title is required!',
      })
      .min(5)
      .max(255),
    type: z.string({
      required_error: 'Package type is required!',
    }),
    billingCycle: z.enum(['yearly', 'monthly']),
    description: z
      .array(z.string().min(1))
      .min(1, { message: 'At least one description point is required!' }),
    price: z.number().min(0, 'Price must be a positive number')
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Package title is required').optional(),
    billingCycle: z.enum(['yearly', 'monthly']).optional(),
    description: z
      .array(z.string().min(1))
      .min(1, { message: 'At least one description point is required!' })
      .optional(),
    price: z.number().min(0, 'Price must be a positive number').optional()
  }),
})

export const PackageValidation = {
  createValidationSchema,
  updateValidationSchema,
}
