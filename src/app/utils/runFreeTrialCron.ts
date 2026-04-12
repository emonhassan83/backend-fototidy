import { Contents } from '../modules/contents/contents.models'
import { modeType } from '../modules/notification/notification.interface'
import {
  SUBSCRIPTION_STATUS,
} from '../modules/subscription/subscription.constants'
import { Subscription } from '../modules/subscription/subscription.models'
import { User } from '../modules/user/user.model'
import { cleanupUserData } from './cleanupUserData'
import emailSender from './emailSender'
import { sendNotification } from './sentNotification'

export const runFreeTrialCron = async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Load global free storage limit
  const appContent = await Contents.findOne()
  const FREE_STORAGE_LIMIT = appContent?.freeStorage || 500 // MB

  // Fetch all users with free trial active
  const users = await User.find({
    isEnabledFreeTrial: true,
    isDeleted: false,
  })

  for (const user of users) {
    if (!user.freeTrialExpiry) continue

    const expiryDate = new Date(user.freeTrialExpiry)
    expiryDate.setHours(0, 0, 0, 0)

    const diffDays = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24),
    )

    // ------------------------------------------------------------------
    // 1️⃣ SEND WARNING 2 DAYS BEFORE FREE TRIAL EXPIRY
    // ------------------------------------------------------------------
    if (diffDays === 2) {
      await emailSender(
        user.email,
        'Important Notice: Your Free Trial Will Expire Soon',
        `
        Hi ${user.name},<br/><br/>

        We trust this message finds you well.<br/><br/>

        This is a friendly reminder that your <strong>FotoTidy free trial expires in 2 days</strong>.<br/>
        After your trial ends, premium features will be paused.<br/><br/>

        Additionally, if no subscription is activated, <strong>your account will undergo automatic cleanup 7 days after expiry</strong>, removing:<br/>
          • Tags exceeding the free limit (max 5 tags)<br/>
          • Photos exceeding the free storage capacity (up to 512MB)<br/><br/>

        Please consider upgrading to maintain uninterrupted access.<br/><br/>

        Warm regards,<br/>
        <strong>FotoTidy Support Team</strong>
        `,
      )

      if (user.fcmToken) {
        const notifyPayload = {
          receiver: user._id,
          message: 'Free Trial Expiring Soon',
          description:
            'Your free trial ends in 2 days. Upgrade now to avoid losing premium features.',
          reference: user._id,
          model_type: modeType.User,
        }

        await sendNotification([user.fcmToken], notifyPayload)
      }
    }

    // ------------------------------------------------------------------
    // 2️⃣ FREE TRIAL EXPIRED — CHECK IF USER HAS ACTIVE SUBSCRIPTION
    // ------------------------------------------------------------------
    if (today >= expiryDate) {
      const subscription = await Subscription.findOne({
        user: user._id,
        status: SUBSCRIPTION_STATUS.active,
        isDeleted: false,
      })

      // Subscription exists → DO NOT CLEAN
      if (subscription) continue

      // No subscription → Cleanup user data
      await cleanupUserData(user._id.toString(), FREE_STORAGE_LIMIT)

      // Mark free trial disabled (optional but recommended)
      await User.findByIdAndUpdate(user._id, {
        isEnabledFreeTrial: false,
      })
    }
  }
}
