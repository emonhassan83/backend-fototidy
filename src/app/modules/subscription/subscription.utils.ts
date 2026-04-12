import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { findAdmin } from '../../utils/findAdmin'
import { TPackage } from '../package/package.interface'
import { sendNotification } from '../../utils/sentNotification'
import { TUser } from '../user/user.interface'

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
