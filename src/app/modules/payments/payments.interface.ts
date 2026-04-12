import { Model, Types } from 'mongoose'
import { TUser } from '../user/user.interface'
import { TSubscriptions } from '../subscription/subscription.interface'
import { TPaymentStatus } from './payments.constants'

export interface TPayment {
  _id?: Types.ObjectId
  user: Types.ObjectId | TUser
  subscription: Types.ObjectId | TSubscriptions
  revenueCatEventType: 'INITIAL_PURCHASE' | 'RENEWAL' | 'CANCELLATION' | 'EXPIRATION' | 'REFUND';
  revenueCatProductId?: string
  revenueCatTransactionId?: string
  amount: number
  currency?: string;
  status: TPaymentStatus
  rawEventData?: unknown
  purchasedAt?: Date;
  isDeleted: boolean
  createdAt?: Date;
  updatedAt?: Date;
}

export type TPaymentModel = Model<TPayment, Record<string, unknown>>
