import { Types } from 'mongoose'
import { z } from 'zod'

const verifyValidationSchema = z.object({
  body: z.object({
    userId: z.string().refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid user ID',
    }),
  }),
})

const verifyPlayValidationSchema = z.object({
  body: z.object({
    productId: z.string({
      required_error: 'Product ID is required',
    }),
    purchaseToken: z.string({
      required_error: 'Purchase token is required',
    }),
  }),
})

export const subscriptionValidation = {
  verifyValidationSchema,
  verifyPlayValidationSchema,
}
