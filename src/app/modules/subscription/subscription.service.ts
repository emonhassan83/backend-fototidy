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
import { verifyAppleReceipt, verifyPlayReceipt } from './subscription.utils'

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

        const packageTitle = 'Subscription Package'

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

// const verifyAppleReceipt = async (receiptData: string) => {
//   try {
//     const purchases = await verifyAppleReceipt.validate({
//       receipt: receiptData,
//     })

//     if (!purchases || purchases.length === 0) {
//       throw new Error('No valid purchases found')
//     }

//     // Latest active purchase খুঁজো
//     const now = Date.now()
//     const activePurchases = purchases.filter(
//       (p: any) => p.expirationDate && p.expirationDate > now,
//     )

//     // সবচেয়ে দেরিতে expire হবে সেটা নাও
//     const latestPurchase = activePurchases.sort(
//       (a: any, b: any) => b.expirationDate - a.expirationDate,
//     )[0] || purchases[purchases.length - 1]

//     return {
//       productId: latestPurchase.productId,
//       originalTransactionId: latestPurchase.originalTransactionId,
//       latestTransactionId: latestPurchase.transactionId,
//       expirationDate: latestPurchase.expirationDate
//         ? new Date(latestPurchase.expirationDate)
//         : null,
//       isActive: latestPurchase.expirationDate
//         ? latestPurchase.expirationDate > now
//         : false,
//       purchases,
//     }
//   } catch (err: any) {
//     throw new Error(`Apple receipt verification failed: ${err.message}`)
//   }
// }

const verifyAndSaveSubscription = async (
  userId: string,
  receiptData: string,
) => {
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // Apple থেকে verify করো
  const verifiedReceipt = await verifyAppleReceipt(receiptData)

  if (!verifiedReceipt.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No active subscription found in receipt',
    )
  }

  const {
    productId,
    originalTransactionId,
    latestTransactionId,
    expirationDate,
  } = verifiedReceipt

  // productId থেকে entitlement বের করো
  const entitlement = productId.toLowerCase().includes('pro') ? 'pro' : 'core'

  // Existing subscription check করো
  const existingSubscription = await Subscription.findOne({
    user: userId,
    appleOriginalTransactionId: originalTransactionId,
  })

  if (existingSubscription) {
    // Update existing
    await Subscription.updateOne(
      { _id: existingSubscription._id },
      {
        productId,
        entitlement,
        status: 'active',
        expiredAt: expirationDate,
        appleLatestTransactionId: latestTransactionId,
        appleReceiptData: receiptData,
      },
    )
  } else {
    // Create new — আগের সব cancel করো
    await Subscription.updateMany(
      { user: userId, status: 'active' },
      { status: 'cancelled' },
    )

    await Subscription.create({
      user: userId,
      productId,
      entitlement,
      store: 'APP_STORE',
      status: 'active',
      expiredAt: expirationDate,
      appleOriginalTransactionId: originalTransactionId,
      appleLatestTransactionId: latestTransactionId,
      appleReceiptData: receiptData,
    })
  }

  // User packageExpiry update করো
  await User.updateOne({ _id: userId }, { packageExpiry: expirationDate })

  return {
    success: true,
    productId,
    entitlement,
    expiredAt: expirationDate,
    isProUser: entitlement === 'pro',
  }
}

// ===== verifyAndSavePlaySubscription =====
const verifyAndSavePlaySubscription = async (
  userId: string,
  payload: { productId: string; purchaseToken: string },
) => {
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const { productId, purchaseToken } = payload
  const receipt = await verifyPlayReceipt(
    'com.fototidy.fotoTidy',
    productId,
    purchaseToken,
  )

  const expiredAt = receipt.expiryTimeMillis
    ? new Date(Number(receipt.expiryTimeMillis))
    : null

  const isActive = expiredAt ? expiredAt > new Date() : false
  const isCancelled =
    receipt.cancelReason !== null && receipt.cancelReason !== undefined

  let status: 'active' | 'expired' | 'cancelled' | 'grace_period' = 'active'
  if (isCancelled) status = 'cancelled'
  else if (!isActive) status = 'expired'
  else status = 'active'

  const entitlement = productId.toLowerCase().includes('pro') ? 'pro' : 'core'

  await Subscription.updateOne(
    { user: userId, store: 'PLAY_STORE' },
    {
      user: userId,
      productId,
      entitlement,
      store: 'PLAY_STORE',
      status,
      expiredAt,
      playPurchaseToken: purchaseToken, // ✅ আলাদা field
    },
    { upsert: true },
  )

  if (expiredAt && status === 'active') {
    await User.updateOne({ _id: userId }, { packageExpiry: expiredAt })
  }

  return {
    productId,
    entitlement,
    expiredAt,
    status,
    isProUser: entitlement === 'pro',
  }
}

const handleAppleWebhook = async (payload: any) => {
  console.log('📥 Apple Webhook:', payload.notificationType)

  const notificationType = payload.notificationType
  const latestReceiptInfo =
    payload.unified_receipt?.latest_receipt_info?.[0] ||
    payload.latest_receipt_info?.[0]

  if (!latestReceiptInfo) {
    console.warn('No receipt info in webhook payload')
    return { success: false }
  }

  const originalTransactionId = latestReceiptInfo.original_transaction_id
  const productId = latestReceiptInfo.product_id
  const expirationDateMs = latestReceiptInfo.expires_date_ms
  const expirationDate = expirationDateMs
    ? new Date(parseInt(expirationDateMs))
    : null

  // Subscription খুঁজো
  const subscription = await Subscription.findOne({
    appleOriginalTransactionId: originalTransactionId,
  })

  if (!subscription) {
    console.warn(
      'Subscription not found for transaction:',
      originalTransactionId,
    )
    return { success: false }
  }

  const userId = subscription.user.toString()

  // notification type অনুযায়ী handle করো
  switch (notificationType) {
    case 'DID_RENEW':
    case 'INITIAL_BUY':
      // ✅ Renewal বা নতুন purchase
      await Subscription.updateOne(
        { _id: subscription._id },
        {
          status: 'active',
          expiredAt: expirationDate,
          appleLatestTransactionId: latestReceiptInfo.transaction_id,
          productId,
        },
      )
      await User.updateOne({ _id: userId }, { packageExpiry: expirationDate })
      console.log(`✅ Renewed: ${productId} | Expires: ${expirationDate}`)
      break

    case 'DID_CHANGE_RENEWAL_PREF':
    case 'DID_CHANGE_RENEWAL_STATUS':
      // ✅ Plan change বা auto-renewal toggle
      const autoRenewStatus = payload.auto_renew_status
      if (autoRenewStatus === '0') {
        // Auto-renewal বন্ধ — এখনো active কিন্তু renew হবে না
        console.log('Auto-renewal disabled for:', originalTransactionId)
      }
      await Subscription.updateOne(
        { _id: subscription._id },
        { expiredAt: expirationDate },
      )
      break

    case 'CANCEL':
      // ✅ Apple refund করে cancel করেছে
      await Subscription.updateOne(
        { _id: subscription._id },
        { status: 'cancelled', expiredAt: null },
      )
      await User.updateOne({ _id: userId }, { packageExpiry: null })
      console.log(`❌ Cancelled: ${originalTransactionId}`)
      break

    case 'DID_FAIL_TO_RENEW':
      // ✅ Payment failed — grace period
      await Subscription.updateOne(
        { _id: subscription._id },
        { status: 'grace_period' },
      )
      console.log(`⚠️ Grace period: ${originalTransactionId}`)
      break

    case 'EXPIRED':
      // ✅ Subscription expired
      await Subscription.updateOne(
        { _id: subscription._id },
        { status: 'expired', expiredAt: expirationDate },
      )
      await User.updateOne({ _id: userId }, { packageExpiry: null })
      console.log(`🕐 Expired: ${originalTransactionId}`)
      break

    default:
      console.log('Unhandled notification type:', notificationType)
  }

  return { success: true, notificationType, originalTransactionId }
}

// ===== handlePlayWebhook =====
const handlePlayWebhook = async (payload: any) => {
  console.log(
    '📥 Play Store Webhook:',
    payload.subscriptionNotification?.notificationType,
  )

  const subscriptionNotification = payload.subscriptionNotification
  if (!subscriptionNotification) {
    console.warn('No subscriptionNotification in webhook payload')
    return { success: false }
  }

  const { notificationType, purchaseToken, subscriptionId } =
    subscriptionNotification

  const subscription = await Subscription.findOne({
    productId: subscriptionId,
    store: 'PLAY_STORE',
  })

  if (!subscription) {
    console.warn('Subscription not found:', subscriptionId)
    return { success: false }
  }

  const userId = subscription.user.toString()

  switch (notificationType) {
    case 1: // SUBSCRIPTION_RECOVERED
    case 2: // SUBSCRIPTION_RENEWED
    case 4: {
      // SUBSCRIPTION_PURCHASED
      // ✅ Play API call করে fresh expiry নাও
      const receipt = await verifyPlayReceipt(
        'com.fototidy.fotoTidy',
        subscriptionId,
        purchaseToken,
      )
      const expiredAt = receipt.expiryTimeMillis
        ? new Date(Number(receipt.expiryTimeMillis))
        : null

      await Subscription.updateOne(
        { _id: subscription._id },
        { status: 'active', expiredAt, playPurchaseToken: purchaseToken },
      )
      if (expiredAt) {
        await User.updateOne({ _id: userId }, { packageExpiry: expiredAt })
      }
      console.log(`✅ Active: ${subscriptionId} | Expires: ${expiredAt}`)
      break
    }

    case 5: // SUBSCRIPTION_ON_HOLD
    case 6: // SUBSCRIPTION_IN_GRACE_PERIOD
      await Subscription.updateOne(
        { _id: subscription._id },
        { status: 'grace_period' },
      )
      console.log(`⚠️ Grace period: ${subscriptionId}`)
      break

    case 3: // SUBSCRIPTION_CANCELED
      await Subscription.updateOne(
        { _id: subscription._id },
        { status: 'cancelled', expiredAt: null },
      )
      await User.updateOne({ _id: userId }, { packageExpiry: null })
      console.log(`❌ Cancelled: ${subscriptionId}`)
      break

    case 13: // SUBSCRIPTION_EXPIRED
      await Subscription.updateOne(
        { _id: subscription._id },
        { status: 'expired' },
      )
      await User.updateOne({ _id: userId }, { packageExpiry: null })
      console.log(`🕐 Expired: ${subscriptionId}`)
      break

    default:
      console.log('Unhandled Play notification type:', notificationType)
  }

  return { success: true, notificationType, subscriptionId }
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
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const subscription = await Subscription.findOne({
    user: userId,
    status: 'active',
    isDeleted: false,
  })

  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, 'Active subscription not found!')
  }

  // ✅ সবসময় local DB তে cancel mark করো
  await Subscription.updateOne(
    { _id: subscription._id },
    { status: 'cancelled', expiredAt: null },
  )

  await User.updateOne({ _id: userId }, { packageExpiry: null })

  return {
    success: true,
    message:
      'Subscription cancelled in our system. Please also cancel from your App Store / Play Store account settings.',
  }
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
  verifyAndSaveSubscription,
  verifyAndSavePlaySubscription,
  getAllSubscription,
  getSubscriptionById,
  chancelSubscriptionFromDB,
  deleteSubscription,
  handleAppleWebhook,
  handlePlayWebhook,
}
