import { Types } from 'mongoose'
import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
    user: z.string().refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid user ID',
    }),

    photo: z.string().refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid upload photo ID',
    }),
  }),
})

export const FavoriteValidation = {
  createValidationSchema
}
