import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
    title: z.string({
      required_error: 'Tag title is required!',
    })
  }),
})

const transferPhotosValidationSchema = z.object({
  body: z.object({
    tag: z.string({
      required_error: 'Tag id is required!',
    }),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Tag title is required').optional(),
  }),
})

export const TagValidation = {
  createValidationSchema,
  updateValidationSchema,
  transferPhotosValidationSchema,
}
