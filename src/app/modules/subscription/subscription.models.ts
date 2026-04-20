import { model, Schema } from 'mongoose'
import { TSubscriptions, TSubscriptionsModel } from './subscription.interface'

// subscription.model.ts
const subscriptionsSchema = new Schema<TSubscriptions>(
  {
    user: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true,
    },

    // RevenueCat Core Fields
    revenueCatAppUserId: { 
      type: String, 
      required: true,
      index: true,
    },
    entitlement: { 
      type: String, 
      required: true,
      index: true,
    },
    productId: { 
      type: String, 
      index: true,                    // "core", "pro", "core_year", "pro_year"
    },

    // Optional fields
    package: { 
      type: Schema.Types.ObjectId, 
      ref: 'Package',
      required: false,
    },

    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'grace_period'],
      default: 'active',
      index: true,
    },
    expiredAt: { 
      type: Date,
      index: true,
    },

    revenueCatTransactionId: { type: String, index: true },

    isDeleted: { 
      type: Boolean, 
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index
subscriptionsSchema.index({ user: 1, status: 1, expiredAt: 1 });

export const Subscription = model<TSubscriptions, TSubscriptionsModel>('Subscription', subscriptionsSchema);