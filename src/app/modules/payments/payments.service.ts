import httpStatus from 'http-status'
import mongoose from 'mongoose'
import { Subscription } from '../subscription/subscription.models'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { User } from '../user/user.model'
import { Payment } from './payments.models'
import { PAYMENT_STATUS } from './payments.constants'
import { notifyUserAboutSubscriptionChange } from './payments.utils'

const handleRevenueCatWebhook = async (event: any) => {
  console.log(`📥 RevenueCat Webhook: ${event.type} | User: ${event.app_user_id}`);

  const userId = event.app_user_id;
  const eventType = event.type as string;
  const entitlement = event.entitlement_ids?.[0] || 'Foto Tidy Pro';
  const expiredAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

  if (!userId || !eventType) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid webhook payload');
  }

  const MAX_RETRIES = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // ====================== 1. Subscription Management ======================
        let subscription = await Subscription.findOne({
          revenueCatAppUserId: userId,
        }).session(session);

        const isTerminalEvent = ['EXPIRATION', 'CANCELLATION'].includes(eventType);

        if (subscription) {
          subscription.entitlement = entitlement;
          subscription.productId = event.product_id || subscription.productId;
          subscription.status = isTerminalEvent ? 'expired' : 'active';
          if (expiredAt) subscription.expiredAt = expiredAt;
          subscription.revenueCatTransactionId = event.original_transaction_id || event.transaction_id;
          await subscription.save({ session });
        } else {
          [subscription] = await Subscription.create([{
            user: userId,
            revenueCatAppUserId: userId,
            entitlement,
            productId: event.product_id,
            status: isTerminalEvent ? 'expired' : 'active',
            expiredAt,
            revenueCatTransactionId: event.original_transaction_id || event.transaction_id,
          }], { session });
        }

        // ====================== 2. Payment Record (Idempotent) ======================
        if (['INITIAL_PURCHASE', 'RENEWAL'].includes(eventType)) {
          const transactionId = event.original_transaction_id || event.transaction_id;

          const existingPayment = await Payment.findOne({
            revenueCatTransactionId: transactionId,
          }).session(session);

          if (!existingPayment) {
            await Payment.create([{
              user: userId,
              subscription: subscription._id,
              revenueCatEventType: eventType,
              revenueCatProductId: event.product_id,
              revenueCatTransactionId: transactionId,
              amount: event.price || 0,
              currency: event.currency || 'USD',
              status: PAYMENT_STATUS.paid,
              purchasedAt: event.purchased_at_ms ? new Date(event.purchased_at_ms) : new Date(),
              rawEventData: event,
            }], { session });

            console.log(`💰 ${eventType} Payment Recorded | Amount: ${event.price}`);
          }
        }

        // ====================== 3. Update User ======================
        if (expiredAt && !isTerminalEvent) {
          await User.findByIdAndUpdate(userId, { packageExpiry: expiredAt }, { session });
        } else if (isTerminalEvent) {
          await User.findByIdAndUpdate(userId, { packageExpiry: null }, { session });
        }
      });

      // Success
      console.log(`✅ Webhook processed successfully: ${eventType} for user ${userId}`);
      return { success: true, eventType, userId };

    } catch (error: any) {
      lastError = error;
      await session.abortTransaction();

      const isRetryable = error.code === 112 || 
                         error.hasErrorLabel?.('TransientTransactionError') ||
                         error.message?.includes('WriteConflict');

      if (isRetryable && attempt < MAX_RETRIES) {
        console.warn(`⚠️ WriteConflict on attempt ${attempt} for ${eventType}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // exponential backoff
        continue;
      }

      console.error(`❌ Webhook Error (${eventType}) after ${attempt} attempts:`, error);
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Webhook processing failed');
    } finally {
      session.endSession();
    }
  }
};

const getAllPaymentsFromDB = async (query: Record<string, any>) => {
  const paymentModel = new QueryBuilder(
    Payment.find().populate([
      { path: 'subscription', select: 'user type status paymentStatus' },
      { path: 'account', select: 'name email photoUrl' },
    ]),
    query,
  )
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await paymentModel.modelQuery
  const meta = await paymentModel.countTotal()

  return {
    data,
    meta,
  }
}

const dashboardData = async (query: Record<string, any>) => {
  const paymentModel = new QueryBuilder(
    Payment.find({ isDeleted: false, status: 'paid' })
      .populate('user', 'name email photoUrl')
      .populate('subscription', 'entitlement status'),
    query,
  )
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const earningList = await paymentModel.modelQuery

  // ✅ Total subscription purchases
  const subscriptionPurchased = await Payment.countDocuments({
    isDeleted: false,
    status: 'paid',
    revenueCatEventType: {
      $in: ['INITIAL_PURCHASE', 'RENEWAL'],
    },
  })

  // ✅ Total earnings
  const totalEarningResult = await Payment.aggregate([
    {
      $match: {
        isDeleted: false,
        status: 'paid',
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ])

  return {
    data: {
      totalEarning: totalEarningResult[0]?.total || 0,
      subscriptionPurchased,
      earningList,
    },
    meta: await paymentModel.countTotal(),
  }
}

const getAPaymentsFromDB = async (id: string) => {
  const payment = await Payment.findById(id)
    .populate('user', 'name email photoUrl')
    .populate('subscription')

  if (!payment || payment.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found!')
  }

  return payment
}

export const paymentsService = {
  handleRevenueCatWebhook,
  dashboardData,
  getAllPaymentsFromDB,
  getAPaymentsFromDB,
}
