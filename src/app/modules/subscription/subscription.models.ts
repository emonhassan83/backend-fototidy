import { model, Schema } from 'mongoose'
import { TSubscriptions, TSubscriptionsModel } from './subscription.interface'

const subscriptionsSchema = new Schema<TSubscriptions>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Apple Fields
    appleOriginalTransactionId: { type: String, index: true },
    appleLatestTransactionId: { type: String, index: true },
    appleReceiptData: { type: String }, // raw receipt
    productId: {
      type: String,
      index: true, // "core", "pro", "core_year", "pro_year"
    },
    entitlement: { type: String, index: true },
    store: {
      type: String,
      enum: ['APP_STORE', 'PLAY_STORE'],
      default: 'APP_STORE',
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'grace_period'],
      default: 'active',
      index: true,
    },
    expiredAt: { type: Date, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
)

subscriptionsSchema.index({ user: 1, status: 1, expiredAt: 1 })
export const Subscription = model<TSubscriptions, TSubscriptionsModel>(
  'Subscription',
  subscriptionsSchema,
)