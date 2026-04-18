import { model, Schema } from 'mongoose'
import { TPayment, TPaymentModel } from './payments.interface'
import { PAYMENT_STATUS } from './payments.constants'

// Define the Mongoose schema
const paymentSchema = new Schema<TPayment>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // ✅ Performance
    },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },

    // RevenueCat specific fields
    revenueCatEventType: { 
      type: String, 
      enum: ['INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'EXPIRATION', 'REFUND'],
      required: false 
    },
    revenueCatProductId: { type: String },
    revenueCatTransactionId: { 
      type: String,
      unique: true, // ✅ Prevent duplicate payment records
      sparse: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: { 
      type: String, 
      default: 'USD' 
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'failed', 'refunded'],
      default: 'paid',
    },
    purchasedAt: { 
      type: Date, 
      default: Date.now 
    },
    rawEventData: { 
      type: Schema.Types.Mixed 
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Index for payment history queries
paymentSchema.index({ user: 1, createdAt: -1 });

export const Payment = model<TPayment, TPaymentModel>('Payment', paymentSchema);
