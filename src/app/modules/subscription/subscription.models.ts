import { model, Schema } from 'mongoose'
import { TSubscriptions, TSubscriptionsModel } from './subscription.interface'
import { SUBSCRIPTION_STATUS } from './subscription.constants'

const subscriptionsSchema = new Schema<TSubscriptions>(
  {
    user: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true,
    },

    // ==================== Apple IAP Fields ====================
    entitlement: { 
      type: String, 
      required: true,
      index: true,                    // entitlement name search-এর জন্য
    },
    productId: { 
      type: String, 
      index: true,                    // "core", "pro", "core_year", "pro_year"
    },
    packageIdentifier: { 
      type: String, 
      index: true,                    // Flutter থেকে আসা string identifier
    },

    // Package reference (যদি তোমার আলাদা Package collection থাকে)
    package: { 
      type: Schema.Types.ObjectId, 
      ref: 'Package',
      required: false,                // optional — কারণ Flutter string পাঠায়
    },

    // Status & Expiry
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'grace_period'],
      default: 'active',
      index: true,
    },
    expiredAt: { 
      type: Date,
      index: true,                    // expiry query-এর জন্য খুব জরুরি
    },

    // Transaction Info
    transactionId: { 
      type: String,
      index: true,                    // Apple transaction ID
    },
    receiptData: { 
      type: String,                   // Apple receipt (base64) — debugging & future use
    },

    // Old RevenueCat fields (optional রাখা হয়েছে migration-এর জন্য)
    revenueCatAppUserId: { 
      type: String,
      index: true,
    },
    revenueCatTransactionId: { 
      type: String 
    },

    isDeleted: { 
      type: Boolean, 
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,                 // createdAt, updatedAt
  }
);

// Compound index for user subscription lookup
subscriptionsSchema.index({ user: 1, status: 1 });

// Create and export the model
export const Subscription = model<TSubscriptions, TSubscriptionsModel>(
  'Subscription',
  subscriptionsSchema,
)
