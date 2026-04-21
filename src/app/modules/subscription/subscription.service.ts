import cron from 'node-cron'
import httpStatus from 'http-status'
import QueryBuilder from '../../builder/QueryBuilder'
import { Package } from '../package/package.model'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { Subscription } from './subscription.models'
import { SUBSCRIPTION_STATUS } from './subscription.constants'
import { Contents } from '../contents/contents.models'
import { cleanupUserData } from '../../utils/cleanupUserData'
import { modeType } from '../notification/notification.interface'
import { sendNotification } from '../../utils/sentNotification'
import emailSender from '../../utils/emailSender'
import config from '../../config'
import mongoose from 'mongoose'

const getPlanDisplayName = (packageIdentifier: string): string => {
  const map: Record<string, string> = {
    core:      'Foto Tidy Core (Monthly)',
    core_year: 'Foto Tidy Core (Yearly)',
    pro:       'Foto Tidy Pro (Monthly)',
    pro_year:  'Foto Tidy Pro (Yearly)',
  };
  return map[packageIdentifier] || packageIdentifier;
};

export const startSubscriptionCron = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Running RevenueCat Subscription Cron Job...')

    const today = new Date()
    today.setHours(0, 0, 0, 0) // শুধু তারিখ রাখা

    try {
      // ---------------------------------------------------
      // 1️⃣ Notify users 2 days before expiry
      // ---------------------------------------------------
      const subscriptionsExpiringSoon = await Subscription.find({
        expiredAt: {
          $gte: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 দিন পর
          $lt: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 দিন পরের মধ্যে
        },
        status: SUBSCRIPTION_STATUS.active,
        isDeleted: false,
      }).populate('package')

      for (const subscription of subscriptionsExpiringSoon) {
        const user = await User.findById(subscription.user)
        if (!user || user.isDeleted) continue

        const packageTitle = subscription.package
          ? (subscription.package as any).title
          : 'Premium Subscription'

        // Email Notification
        await emailSender(
          user.email,
          'Your Subscription Will Expire Soon',
          `
          Hi ${user.name},<br/><br/>
          Your <strong>${packageTitle}</strong> subscription will expire in 2 days.<br/>
          Please renew your subscription to continue enjoying premium features.<br/><br/>
          Best regards,<br/>
          <strong>FotoTidy Support Team</strong>
          `,
        )

        // Push Notification
        if (user.fcmToken) {
          await sendNotification([user.fcmToken], {
            receiver: user._id,
            message: 'Subscription Expiring Soon',
            description: `Your subscription expires in 2 days. Renew now to keep premium access.`,
            reference: subscription._id,
            model_type: modeType.Subscription,
          })
        }
      }

      // ---------------------------------------------------
      // 2️⃣ Mark expired subscriptions
      // ---------------------------------------------------
      const expiredSubscriptions = await Subscription.find({
        expiredAt: { $lt: today },
        status: SUBSCRIPTION_STATUS.active,
        isDeleted: false,
      })

      for (const subscription of expiredSubscriptions) {
        subscription.status = SUBSCRIPTION_STATUS.expired
        await subscription.save()
        console.log(`Subscription ${subscription._id} marked as expired.`)
      }

      // ---------------------------------------------------
      // 3️⃣ Cleanup user data 7 days after expiry (if no active subscription)
      // ---------------------------------------------------
      for (const subscription of expiredSubscriptions) {
        const user = await User.findById(subscription.user)
        if (!user || user.isDeleted) continue

        const cleanupDate = new Date(subscription.expiredAt!)
        cleanupDate.setDate(cleanupDate.getDate() + 7) // 7 দিন পর

        if (today >= cleanupDate) {
          // চেক করুন বর্তমানে কোনো active subscription আছে কিনা
          const hasActiveSub = await Subscription.exists({
            user: user._id,
            status: SUBSCRIPTION_STATUS.active,
            isDeleted: false,
          })

          if (hasActiveSub) {
            console.log(
              `User ${user._id} has active subscription, skipping cleanup.`,
            )
            continue
          }

          // Cleanup করুন
          const appContent = await Contents.findOne()
          const FREE_STORAGE_LIMIT = appContent?.freeStorage || 500

          await cleanupUserData(user._id.toString(), FREE_STORAGE_LIMIT)

          console.log(
            `🧹 Cleaned up data for user ${user._id} due to long expired subscription.`,
          )
        }
      }

      console.log(
        `✅ RevenueCat Subscription Cron Completed! ` +
          `Warnings sent: ${subscriptionsExpiringSoon.length}, ` +
          `Expired marked: ${expiredSubscriptions.length}`,
      )
    } catch (error: any) {
      console.error('❌ Subscription Cron Job Error:', error.message)
    }
  })
}

const verifySubscription = async (payload: {
  userId: string;
  packageId?: string;
}) => {
  const { userId } = payload;

  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  try {
    console.log(`🔍 RevenueCat V1 Verify for user: ${userId}`);

    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.revenue_cat.secret_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) throw new AppError(httpStatus.BAD_GATEWAY, 'RevenueCat V1 failed');

    const data = await response.json();
    const subscriber = data.subscriber;

    if (!subscriber?.subscriptions) {
      await Subscription.updateOne({ user: userId }, { status: SUBSCRIPTION_STATUS.expired });
      await User.findByIdAndUpdate(userId, { packageExpiry: null });
      return { active: false, message: 'No active subscription found' };
    }

    let bestExpiredAt = new Date(0);
    let bestProductId = 'core';
    let bestEntitlementKey = 'Foto Tidy Pro';

    // সবচেয়ে গুরুত্বপূর্ণ লজিক: subscriptions অবজেক্ট থেকে সবচেয়ে দূরের expiry নাও
    for (const [productKey, sub] of Object.entries<any>(subscriber.subscriptions)) {
      if (sub.expires_date) {
        const expDate = new Date(sub.expires_date);
        if (expDate > bestExpiredAt) {
          bestExpiredAt = expDate;
          bestProductId = productKey;           // core_year, pro_year ইত্যাদি আসবে
          bestEntitlementKey = "Foto Tidy Pro";
        }
      }
    }

    const expiredAt = bestExpiredAt;
    const isActive = expiredAt > new Date();

    console.log(`✅ FINAL Best Subscription → Product: ${bestProductId} | Expires: ${expiredAt} | Active: ${isActive}`);

    if (!isActive) {
      await Subscription.updateOne({ user: userId }, { status: SUBSCRIPTION_STATUS.expired });
      await User.findByIdAndUpdate(userId, { packageExpiry: null });
      return { active: false, message: 'Subscription has expired' };
    }

    const subscription = await Subscription.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        revenueCatAppUserId: userId,
        entitlement: bestEntitlementKey,
        productId: bestProductId,
        status: SUBSCRIPTION_STATUS.active,
        expiredAt,
        revenueCatTransactionId: subscriber.original_transaction_id,
      },
      { upsert: true, new: true }
    );

    await User.findByIdAndUpdate(userId, { packageExpiry: expiredAt });

    return {
      active: true,
      subscription,
      expiredAt,
      productId: bestProductId,
      message: 'Subscription verified successfully (V1)',
    };

  } catch (error: any) {
    console.error('RevenueCat V1 Verify Error:', error);
    throw error instanceof AppError ? error : new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Verify failed');
  }
};

// const restoreSubscription = async (payload: {
//   userId: string
//   packageId: string
//   receiptData?: string
// }) => {
//   const { userId, packageId, receiptData } = payload

//   const user = await User.findById(userId)
//   if (!user || user.isDeleted) {
//     throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
//   }

//   if (receiptData) {
//     return await verifySubscription({ userId, packageId, receiptData })
//   }

//   // Fallback: DB থেকে চেক
//   const existingSub = await Subscription.findOne({ user: userId })
//   if (!existingSub) {
//     return { active: false, message: 'No subscription found to restore' }
//   }

//   const isActive = existingSub.expiredAt && existingSub.expiredAt > new Date()

//   if (isActive) {
//     await Subscription.updateOne(
//       { user: userId },
//       { status: SUBSCRIPTION_STATUS.active },
//     )
//     await User.findByIdAndUpdate(userId, {
//       packageExpiry: existingSub.expiredAt,
//     })
//   }

//   return {
//     active: isActive,
//     subscription: existingSub,
//     expiredAt: existingSub.expiredAt,
//     message: isActive
//       ? 'Subscription restored successfully'
//       : 'Subscription has expired',
//   }
// }

const handleAppleWebhook = async (payload: any) => {
  console.log('📥 Apple Server Notification received')
  console.log(JSON.stringify(payload, null, 2))

  const notificationType = payload.notification_type || payload.notificationType
  const unifiedReceipt =
    payload.unified_receipt || payload.data?.unified_receipt
  const latestInfo = unifiedReceipt?.latest_receipt_info?.[0]

  if (!latestInfo) {
    console.warn('No receipt info in webhook payload')
    return { success: false }
  }

  const productId = latestInfo.product_id
  const transactionId =
    latestInfo.original_transaction_id || latestInfo.transaction_id
  const expiresMs = Number(latestInfo.expires_date_ms)
  const expiredAt = new Date(expiresMs)
  const appUserId = payload.app_account_token || latestInfo.app_account_token

  const isTerminal = ['CANCEL', 'DID_FAIL_TO_RENEW', 'EXPIRED'].includes(
    notificationType,
  )

  if (!appUserId) {
    console.warn('Could not determine userId from webhook')
    return { success: false }
  }

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      await Subscription.findOneAndUpdate(
        { transactionId },
        {
          productId,
          status: isTerminal
            ? SUBSCRIPTION_STATUS.expired
            : SUBSCRIPTION_STATUS.active,
          expiredAt,
        },
        { session },
      )

      if (isTerminal) {
        await User.findOneAndUpdate(
          { _id: appUserId },
          { packageExpiry: null },
          { session },
        )
      } else {
        await User.findOneAndUpdate(
          { _id: appUserId },
          { packageExpiry: expiredAt },
          { session },
        )
      }
    })

    console.log(
      `✅ Apple Webhook processed: ${notificationType} | Product: ${productId}`,
    )
    return { success: true, notificationType, productId }
  } finally {
    session.endSession()
  }
}

const getAllSubscription = async (query: Record<string, any>) => {
  const subscriptionModel = new QueryBuilder(
    Subscription.find({ isDeleted: false })
      .populate('user', 'name email photoUrl')
      .populate('package', 'title price'),
    query,
  )
    .search(['entitlement', 'productId'])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await subscriptionModel.modelQuery
  const meta = await subscriptionModel.countTotal()

  return { data, meta }
}

const getSubscriptionById = async (id: string) => {
  const result = await Subscription.findById(id).populate([
    {
      path: 'package',
      select: '',
    },
    {
      path: 'user',
      select: 'name email photoUrl',
    },
  ])
  if (!result || result?.isDeleted) {
    throw new Error('Subscription not found')
  }

  return result
}

const chancelSubscriptionFromDB = async (userId: string) => {
  //* if the user is is not exist
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const result = await Subscription.updateOne(
    { user: userId },
    { status: SUBSCRIPTION_STATUS.cancelled, expiredAt: null },
  )
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Subscription not found and failed to update cancellation status!',
    )
  }

  await User.updateOne({ _id: userId }, { packageExpiry: null }, { new: true })

  return result
}

const deleteSubscription = async (id: string) => {
  const subscription = await Subscription.findById(id)
  if (!subscription || subscription?.isDeleted) {
    throw new Error('Failed to update subscription')
  }

  const result = await Subscription.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true },
  )

  if (!result) {
    throw new Error('Failed to delete subscription')
  }
  return result
}

export const subscriptionService = {
  verifySubscription,
  getAllSubscription,
  getSubscriptionById,
  chancelSubscriptionFromDB,
  deleteSubscription,
  handleAppleWebhook,
}
