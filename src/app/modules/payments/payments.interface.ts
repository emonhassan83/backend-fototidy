import { Model, Types } from 'mongoose'

export interface TPayment {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  subscription: Types.ObjectId;
  revenueCatEventType: 'INITIAL_PURCHASE' | 'RENEWAL' | 'CANCELLATION' | 'EXPIRATION' | 'REFUND';
  revenueCatProductId?: string;
  revenueCatTransactionId?: string;
  amount: number;
  currency?: string;
  status: string;
  isDeleted?: boolean;
  purchasedAt?: Date;
  rawEventData?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TPaymentModel = Model<TPayment, Record<string, unknown>>
