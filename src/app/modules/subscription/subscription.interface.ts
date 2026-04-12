import { Model, Types } from 'mongoose'
import { TPackage } from '../package/package.interface'
import { TSubscriptionStatus } from './subscription.constants'

export interface TSubscriptions {
  _id?: Types.ObjectId
  user: Types.ObjectId
  package?: Types.ObjectId | TPackage
  revenueCatAppUserId: string
  entitlement: string
  productId?: string
  revenueCatTransactionId?: string
  status: TSubscriptionStatus
  expiredAt: Date
  isDeleted: boolean
  createdAt?: Date
  updatedAt?: Date
}

export type TSubscriptionsModel = Model<TSubscriptions, Record<string, unknown>>
