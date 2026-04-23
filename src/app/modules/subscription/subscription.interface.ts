import { Model, Types } from 'mongoose'

export interface TSubscriptions {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  appleOriginalTransactionId: string;
  appleLatestTransactionId: string;
  appleReceiptData?: string;
  productId?: string;
  entitlement: string;
  store: 'APP_STORE'| 'PLAY_STORE';
  status: 'active' | 'expired' | 'cancelled' | 'grace_period';
  expiredAt?: Date | null;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TSubscriptionsModel = Model<TSubscriptions, Record<string, unknown>>
