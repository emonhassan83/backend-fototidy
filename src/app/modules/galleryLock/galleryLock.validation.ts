import { z } from 'zod'

const createKeyValidationSchema = z.object({
  body: z.object({
    key: z
      .string({
        invalid_type_error: 'Pin must be a string',
      })
      .length(4, { message: 'Pin must be 4 characters' }),
  }),
})

const changeKeyValidationSchema = z.object({
  body: z.object({
    oldKey: z
      .string({
        required_error: 'Old Pin is required',
      })
      .length(4, { message: 'Pin must be 4 characters' }),
    newKey: z
      .string({ required_error: 'Pin is required' })
      .length(4, { message: 'Pin must be 4 characters' }),
  }),
})

export const JournalLockValidation = {
  createKeyValidationSchema,
  changeKeyValidationSchema,
}
