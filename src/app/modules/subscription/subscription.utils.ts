import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { findAdmin } from '../../utils/findAdmin'
import { TPackage } from '../package/package.interface'
import { sendNotification } from '../../utils/sentNotification'
import { TUser } from '../user/user.interface'
import config from '../../config'
import { google } from 'googleapis';
import * as appleReceiptVerify from 'node-apple-receipt-verify'

// Initialize once
appleReceiptVerify.config({
  secret: config.apple.shared_secret!, // App Store Connect থেকে নাও
  environment: ['production', 'sandbox'], // প্রথমে production, fallback sandbox
  verbose: true,        // Debugging logs
  extended: true,       // Extra subscription info
  ignoreExpired: false, // Expired subscriptions retain
  excludeOldTransactions: true,
})

export const verifyAppleReceipt = async (receiptData: string) => {
  try {
    const purchases = await appleReceiptVerify.validate({ receipt: receiptData })

    if (!purchases || purchases.length === 0) {
      throw new Error('No valid purchases found')
    }

    const now = Date.now()
    const activePurchases = purchases.filter(
      (p: any) => p.expirationDate && p.expirationDate > now,
    )

    const latestPurchase =
      activePurchases.sort((a: any, b: any) => b.expirationDate - a.expirationDate)[0] ||
      purchases[purchases.length - 1]

    return {
      productId: latestPurchase.productId,
      originalTransactionId: latestPurchase.originalTransactionId,
      latestTransactionId: latestPurchase.transactionId,
      expirationDate: latestPurchase.expirationDate
        ? new Date(latestPurchase.expirationDate)
        : null,
      isActive: latestPurchase.expirationDate
        ? latestPurchase.expirationDate > now
        : false,
      purchases,
    }
  } catch (err: any) {
    throw new Error(`Apple receipt verification failed: ${err.message}`)
  }
}

export const verifyPlayReceipt = async (packageName: string, productId: string, purchaseToken: string) => {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'service-account.json', // তোমার Google service account key --> config.google.service_account_path, // config থেকে নাও
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  const androidPublisher = google.androidpublisher({ version: 'v3', auth });
  const res = await androidPublisher.purchases.subscriptions.get({
    packageName,
    subscriptionId: productId,
    token: purchaseToken,
  });

  return res.data; // expiryTimeMillis, autoRenewing, cancelReason
};

export const subscriptionNotifyToAdmin = async (
  action: 'ADDED',
  packages: TPackage,
  subscription: any,
) => {
  const admin = await findAdmin()
  if (!admin || !admin?.fcmToken) return

  // Determine the message and description based on the action
  let message
  let description

  switch (action) {
    case 'ADDED':
      message = messages.subscription.newPlan
      description = `A new subscription plan titled "${packages?.title}" has been successfully purchased by a user.`
      break
    default:
      throw new Error('Invalid action type')
  }

  // Create a notification entry
  const notifyPayload = {
    receiver: admin?._id,
    message,
    description,
    reference: subscription?._id,
    model_type: modeType.Subscription,
  }

  await sendNotification([admin!.fcmToken], notifyPayload)
}

export const subscriptionNotifyToUser = async (
  action: 'ADDED' | 'WARNING',
  packages: TPackage,
  subscription?: any,
  user?: TUser,
) => {
  if (!user || !user?.fcmToken) return

  // Determine the message and description based on the action
  let message
  let description

  switch (action) {
    case 'ADDED':
      message = messages.subscription.newPlan
      description = `You have successfully subscribed to the plan titled "${packages?.title}".`
      break

    case 'WARNING':
      message = messages.subscription.warningForPlan
      description = `Your subscription is expiring today. Please renew to continue enjoying our services!`
      break
    default:
      throw new Error('Invalid action type')
  }

  // Create a notification entry
  const notifyPayload = {
    receiver: user?._id,
    message,
    description,
    reference: subscription?._id,
    model_type: modeType.Subscription,
  }

  await sendNotification([user?.fcmToken!], notifyPayload)
}
