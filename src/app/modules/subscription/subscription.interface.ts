import { Model, Types } from 'mongoose'

export interface TSubscriptions {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  revenueCatAppUserId: string;
  entitlement: string;
  productId?: string;
  revenueCatTransactionId?: string;
  package?: Types.ObjectId;
  packageIdentifier: string;
  transactionId: string;
  receiptData: string
  status: 'active' | 'expired' | 'cancelled' | 'grace_period';
  expiredAt?: Date | null;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TSubscriptionsModel = Model<TSubscriptions, Record<string, unknown>>
