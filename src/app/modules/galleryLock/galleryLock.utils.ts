import { sendNotification } from '../../utils/sentNotification'
import { messages } from '../notification/notification.constant'
import { modeType } from '../notification/notification.interface'
import { TUser } from '../user/user.interface'

export const journalNotifyToUser = async (
  action: 'KEY_ADD' | 'KEY_CHANGED' | 'KEY_REMOVED',
  user: TUser,
) => {
  if (!user || !user?.fcmToken) return

  // Determine the message and description based on the action
  let message
  let description

  switch (action) {
    case 'KEY_ADD':
      message = messages.galleryLock.keyAdded
      description = `A new journal key has been added to your account. You’ll need it to unlock or sync your diary across devices.`
      break
    case 'KEY_CHANGED':
      message = messages.galleryLock.keyUpdated
      description = `Your journal key has been updated. Please use the new key for future authentications.`
      break
    case 'KEY_REMOVED':
      message = messages.galleryLock.keyUpdated
      description = `Your journal key has been removed. You will no longer be able to use it for authentication.`
      break
    default:
      throw new Error('Invalid action type')
  }

  // Create a notification entry
  const notifyPayload = {
    receiver: user._id,
    message,
    description,
    model_type: modeType.User,
  }

  await sendNotification([user.fcmToken], notifyPayload)
}
