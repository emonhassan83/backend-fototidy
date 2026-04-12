import { Model, Types } from 'mongoose'
import { TUserRole, TUserStatus } from './user.constant'

export interface TUser {
  _id: Types.ObjectId
  id: string
  name: string
  email: string
  password: string
  fcmToken: string
  photoUrl?: string
  contractNumber?: string
  role: TUserRole
  registerWith: string
  needsPasswordChange: boolean
  passwordChangedAt?: Date
  verification: {
    otp: string | number
    expiresAt: Date
    status: boolean
  }
  status: TUserStatus
  freeStorage: number
  galleryKey: string
  packageExpiry?: Date
  expireAt: Date
  freeTrialExpiry?: Date
  isEnabledFreeTrial: boolean
  freeTrialCleanupDate: Date
  autoCleanupDate: Date
  isActiveLock: boolean
  isDeactivateLock: boolean
  isDeleted: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface TReqUser {
  _id: string
  email: string
  role: TUserRole
  iat: number
  exp: number
}

export interface UserModel extends Model<TUser> {
  isUserExistsByUserName(name: string): Promise<TUser>
  isUserExistsByEmail(email: string): Promise<TUser>

  isPasswordMatched(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean>
}
