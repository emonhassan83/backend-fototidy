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
  userId: string
  packageId?: string
}) => {
  const { userId, packageId } = payload;

  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const REVENUECAT_SECRET = config.revenue_cat.secret_key;
  const REVENUECAT_PROJECT_ID = config.revenue_cat.project_id;   // ← .env থেকে নিন

  if (!REVENUECAT_SECRET || !REVENUECAT_PROJECT_ID) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'RevenueCat configuration missing');
  }

  try {
    console.log(`🔍 Verifying subscription (V2) for user: ${userId}`);

    const response = await fetch(
      `https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${REVENUECAT_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ RevenueCat V2 API Error: ${response.status} - ${errorText}`);

      if (response.status === 404) {
        throw new AppError(httpStatus.NOT_FOUND, 'Subscriber not found in RevenueCat');
      }

      throw new AppError(
        httpStatus.BAD_GATEWAY,
        `RevenueCat API failed: ${response.status}`
      );
    }

    const data = await response.json();

    // V2-এ structure আলাদা
    const entitlements = data.customer?.entitlements || data.subscriber?.entitlements || {};

    console.log('Available Entitlements (V2):', Object.keys(entitlements));

    const proEntitlement = entitlements['Foto Tidy Pro'];

    if (!proEntitlement || !proEntitlement.expiresAt) {   // V2-এ expiresAt হতে পারে
      await Subscription.updateOne(
        { user: userId },
        { status: SUBSCRIPTION_STATUS.expired }
      );

      return { active: false, message: 'No active subscription found' };
    }

    const expiredAt = new Date(proEntitlement.expiresAt || proEntitlement.expires_date);
    const rcProductId = proEntitlement.productIdentifier || proEntitlement.product_identifier;

    // ... বাকি লজিক (subscription update, user update) একই রাখুন

    const subscription = await Subscription.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        revenueCatAppUserId: userId,
        entitlement: 'Foto Tidy Pro',
        productId: rcProductId,
        package: packageId,
        status: SUBSCRIPTION_STATUS.active,
        expiredAt,
        revenueCatTransactionId: proEntitlement.originalTransactionId || null,
      },
      { upsert: true, new: true }
    );

    await User.findByIdAndUpdate(userId, { packageExpiry: expiredAt });

    return { active: true, subscription };

  } catch (error: any) {
    console.error('RevenueCat Verify Error:', error);
    throw error instanceof AppError 
      ? error 
      : new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to verify subscription');
  }
};

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
}
