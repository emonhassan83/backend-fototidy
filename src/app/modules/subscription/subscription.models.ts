import { model, Schema } from 'mongoose'
import { TSubscriptions, TSubscriptionsModel } from './subscription.interface'
import { SUBSCRIPTION_STATUS } from './subscription.constants'

// Define the Mongoose schema
const subscriptionsSchema = new Schema<TSubscriptions>(
  {
    user: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true, // ✅ Performance optimization
    },

    // RevenueCat fields
    revenueCatAppUserId: { 
      type: String, 
      required: true,
      index: true, // ✅ For webhook queries
    },
    entitlement: { 
      type: String, 
      required: true,
    },
    productId: { type: String },
    revenueCatTransactionId: { type: String },

    // Core fields
    package: { 
      type: Schema.Types.ObjectId, 
      ref: 'Package',
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'grace_period'],
      default: 'active',
      index: true, // ✅ For filtering
    },
    expiredAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

// Compound index for user subscription lookup
subscriptionsSchema.index({ user: 1, status: 1 });

// Create and export the model
export const Subscription = model<TSubscriptions, TSubscriptionsModel>(
  'Subscription',
  subscriptionsSchema,
)
