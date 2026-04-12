import { Types } from 'mongoose'
import { z } from 'zod'

const verifyValidationSchema = z.object({
  body: z.object({
    userId: z.string().refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid user ID',
    })
  }),
})

export const subscriptionValidation = {
  verifyValidationSchema,
}
