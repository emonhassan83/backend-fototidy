import { z } from 'zod'
import { USER_STATUS } from './user.constant'

// Define the Zod validation schema
const createValidationSchema = z.object({
  body: z.object({
    name: z.string({
      required_error: 'User name is required!',
    }),
    email: z.string({
      required_error: 'Email is required!',
    }),
    password: z
      .string({
        invalid_type_error: 'Password must be a string',
      })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(18, { message: 'Password cannot be more than 18 characters' }),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    name: z
      .string({
        required_error: 'User name is required!',
      })
      .optional(),
    photoUrl: z
      .string({
        required_error: 'Photo url is required!',
      })
      .optional(),
  }),
})

const changeStatusValidationSchema = z.object({
  body: z.object({
    userId: z.string({
      required_error: 'User id is required!',
    }),
    status: z.enum(Object.values(USER_STATUS) as [string, ...string[]], {
      required_error: 'User status is required!',
    }),
  }),
})

const deactivateLockValidationSchema = z.object({
  body: z.object({
    key: z.string({
      required_error: 'Gallery key is required!',
    }),
  }),
})

export const UserValidation = {
  createValidationSchema,
  updateValidationSchema,
  changeStatusValidationSchema,
  deactivateLockValidationSchema,
}
