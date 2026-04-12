import { z } from 'zod'

// Single photo validation
const singlePhotoSchema = z.object({
  tag: z.array(z.string({ required_error: 'Tag ID is required!' })),
  image: z.string({ required_error: 'Image URL is required!' }),
  fileSize: z
    .number({ required_error: 'File size is required!' })
    .positive('File size must be greater than 0'),
})

//  For single upload (one photo)
const createValidationSchema = z.object({
  body: singlePhotoSchema,
})

// For multiple upload (array of photos)
const multiTagsValidationSchema = z.object({
  body: z.object({
    data: z
      .array(singlePhotoSchema, {
        required_error: 'Photo data is required!',
        invalid_type_error: 'Photos must be an array',
      })
      .min(1, 'At least one photo must be uploaded'),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    tag: z.string().optional(),
  }),
})

export const UploadPhotoValidation = {
  createValidationSchema,
  multiTagsValidationSchema,
  updateValidationSchema,
}
