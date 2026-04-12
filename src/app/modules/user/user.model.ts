import bcrypt from 'bcrypt'
import config from '../../config'
import { Schema, model } from 'mongoose'
import { TUser, UserModel } from './user.interface'
import {
  REGISTER_WITH,
  registerWith,
  USER_ROLE,
  USER_STATUS,
} from './user.constant'
import { generateCryptoString } from '../../utils/generateCryptoString'

const userSchema = new Schema<TUser, UserModel>(
  {
    id: {
      type: String,
      unique: true,
      default: () => generateCryptoString(10),
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    fcmToken: {
      type: String,
    },
    photoUrl: {
      type: String,
      default: null,
    },
    contractNumber: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLE),
      default: USER_ROLE.user,
    },
    registerWith: {
      type: String,
      enum: registerWith,
      default: REGISTER_WITH.credentials,
    },
    needsPasswordChange: {
      type: Boolean,
      default: true,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    verification: {
      otp: {
        type: Schema.Types.Mixed,
        default: 0,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      status: {
        type: Boolean,
        default: false,
      },
    },
    galleryKey: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.active,
    },
    freeStorage: {
      type: Number,
      default: 0,
    },
    packageExpiry: { type: Date, default: null },
    expireAt: {
      type: Date,
      default: () => {
        const expireAt = new Date()
        return expireAt.setMinutes(expireAt.getMinutes() + 30)
      },
    },
    freeTrialExpiry: { type: Date, default: null },
    freeTrialCleanupDate: { type: Date, default: null },
    autoCleanupDate: { type: Date, default: null },
    isEnabledFreeTrial: { type: Boolean, default: false },
    isDeactivateLock: { type: Boolean, default: false },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isActiveLock: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// added index for auto delete
userSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

//* Hash password before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(
      this.password,
      Number(config.bcrypt_salt_rounds),
    )
  }
  next()
})

//* Static method to check if user exists by email
userSchema.statics.isUserExistsByEmail = async function (
  email: string,
): Promise<TUser | null> {
  return await this.findOne({ email })
}

//* Static method to compare passwords
userSchema.statics.isPasswordMatched = async function (
  plainTextPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(plainTextPassword, hashedPassword)
}

export const User = model<TUser, UserModel>('User', userSchema)
