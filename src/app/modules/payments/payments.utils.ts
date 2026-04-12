import Stripe from 'stripe'
import config from '../../config'
import { findAdmin } from '../../utils/findAdmin'
import { messages } from '../notification/notification.constant'
import { modeType } from '../notification/notification.interface'
import { sendNotification } from '../../utils/sentNotification'
import { Types } from 'mongoose'
import { User } from '../user/user.model'
import emailSender from '../../utils/emailSender'

const stripe: Stripe = new Stripe(config.stripe?.stripe_api_secret as string, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})
interface TPayload {
  product: {
    amount: number
    name: string
    quantity: number
  }
  customer: {
    name: string
    email: string
  }
  paymentId: string | Types.ObjectId
}

export const createCheckoutSession = async (payload: TPayload) => {
  const { customer: customerData } = payload

  const customer = await stripe.customers.create({
    name: customerData.name,
    email: customerData.email,
  })

  const paymentGatewayData = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: payload?.product?.name,
          },
          unit_amount: payload.product?.amount * 100,
        },
        quantity: payload.product?.quantity,
      },
    ],

    success_url: `${config.server_url}/payments/confirm-payment?sessionId={CHECKOUT_SESSION_ID}&paymentId=${payload?.paymentId}`,
    cancel_url: config?.payment_cancel_url,
    mode: 'payment',
    // metadata: {
    //   user: JSON.stringify({
    //     paymentId: payment.id,
    //   }),
    // },
    invoice_creation: {
      enabled: true,
    },
    customer: customer.id,
    // payment_intent_data: {
    //   metadata: {
    //     payment: JSON.stringify({
    //       ...payment,
    //     }),
    //   },
    // },
    payment_method_types: ['card'],
  })

  return paymentGatewayData
}

export const paymentNotifyToAdmin = async (
  type: 'SUCCESS' | 'REFUND',
  payment: any,
) => {
  const admin = await findAdmin()
  if (!admin || !admin?.fcmToken!) return

  // Define message and description based on type
  const message =
    type === 'SUCCESS'
      ? messages.paymentManagement.paymentSuccess
      : messages.paymentManagement.paymentRefunded

  const description =
    type === 'SUCCESS'
      ? `A payment of $${payment.amount} has been successfully received. Transaction ID: ${payment.tranId}.`
      : `A refund of $${payment.amount} has been successfully processed. Refund Transaction ID: ${payment.tranId}.`

  // Create a notification entry
  const notifyPayload = {
    receiver: admin?._id,
    message,
    description,
    reference: payment.subscription,
    model_type: modeType.Payment,
  }

  await sendNotification([admin!.fcmToken], notifyPayload)
}

export const paymentNotifyToUser = async (
  type: 'SUCCESS' | 'REFUND',
  payment: any,
) => {
  const user = await User.findById(payment.account)
  if (!user || !user?.fcmToken) return

  // Define message and description based on type
  const message =
    type === 'SUCCESS'
      ? messages.paymentManagement.paymentSuccess
      : messages.paymentManagement.paymentRefunded

  const description =
    type === 'SUCCESS'
      ? `Your payment of $${payment.amount} has been successfully processed. Transaction ID: ${payment.tranId}.`
      : `A refund of $${payment.amount} has been issued to your account. Refund Transaction ID: ${payment.tranId}.`

  // Create a notification entry
  const notifyPayload = {
    receiver: payment?.user,
    message,
    description,
    reference: payment.subscription,
    model_type: modeType.Payment,
  }

  await sendNotification([payment.user.fcmToken], notifyPayload)
}

// ====================== Retry Helper ======================
async function retryOperation(operation: () => Promise<void>, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await operation()
      return
    } catch (err) {
      console.error(`Retry ${i + 1} failed:`, err)
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay))
      } else {
        throw err
      }
    }
  }
}

// ====================== Notification Function ======================
export const notifyUserAboutSubscriptionChange = async (
  userId: string,
  eventType: string,
  expiredAt?: Date | null,
): Promise<void> => {
  try {
    const user = await User.findById(userId)
      .select('name email fcmToken')
      .lean()

    if (!user) {
      console.warn(`⚠️ Notification skipped: User ${userId} not found`)
      return
    }

    let subject = ''
    let emailBody = ''
    let pushTitle = ''
    let pushDescription = ''

    const expiryDate = expiredAt
      ? expiredAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'further notice'

    switch (eventType) {
      case 'INITIAL_PURCHASE':
        subject = '🎉 Welcome to FotoTidy Pro!'
        pushTitle = 'Welcome to Pro!'
        pushDescription =
          'Thank you for subscribing. You now have full access to all premium features.'
        emailBody = `
          Hi ${user.name},<br/><br/>
          Thank you for subscribing to <strong>FotoTidy Pro</strong>!<br/><br/>
          Your subscription is active until <strong>${expiryDate}</strong>.<br/><br/>
          Best regards,<br/>
          <strong>FotoTidy Support Team</strong>
        `
        break

      case 'RENEWAL':
        subject = '✅ Subscription Renewed Successfully'
        pushTitle = 'Subscription Renewed'
        pushDescription = `Your Pro subscription has been renewed. Valid until ${expiryDate}.`
        emailBody = `
          Hi ${user.name},<br/><br/>
          Your <strong>FotoTidy Pro</strong> subscription has been renewed successfully.<br/><br/>
          Valid until <strong>${expiryDate}</strong>.<br/><br/>
          Best regards,<br/>
          <strong>FotoTidy Support Team</strong>
        `
        break

      case 'EXPIRATION':
      case 'CANCELLATION':
        subject = '⚠️ Your Subscription Has Ended'
        pushTitle = 'Subscription Ended'
        pushDescription =
          'Your subscription has expired. Please renew to continue enjoying premium features.'
        emailBody = `
          Hi ${user.name},<br/><br/>
          Your <strong>FotoTidy Pro</strong> subscription has ${
            eventType === 'CANCELLATION' ? 'been cancelled' : 'expired'
          }. Please renew to continue.<br/><br/>
          Best regards,<br/>
          <strong>FotoTidy Support Team</strong>
        `
        break

      default:
        console.warn(`⚠️ Unknown eventType for notification: ${eventType}`)
        return
    }

    // Email with retry
    try {
      await retryOperation(() => emailSender(user.email, subject, emailBody))
      console.log(`📧 Email sent to ${user.email} for ${eventType}`)
    } catch (emailError) {
      console.error(`❌ Failed to send email to ${user.email}:`, emailError)
    }

    // Push with retry
    if (user.fcmToken) {
      try {
        await retryOperation(() =>
          sendNotification([user.fcmToken], {
            receiver: user._id,
            message: pushTitle,
            description: pushDescription,
            model_type: modeType.Subscription,
          }),
        )
        console.log(`📱 Push notification sent to user ${userId} for ${eventType}`)
      } catch (pushError) {
        console.error(`❌ Failed to send push notification to ${userId}:`, pushError)
      }
    }
  } catch (error: any) {
    console.error(`❌ Error in notifyUserAboutSubscriptionChange:`, error)
  }
}
