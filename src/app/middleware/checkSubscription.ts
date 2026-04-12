import { NextFunction, Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import AppError from '../errors/AppError'
import httpStatus from 'http-status'
import { USER_ROLE } from '../modules/user/user.constant'
import { User } from '../modules/user/user.model'
import { Subscription } from '../modules/subscription/subscription.models'
import {
  SUBSCRIPTION_STATUS,
} from '../modules/subscription/subscription.constants'

const checkSubscriptionAccess = () => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id
    const userRole = req.user?.role

    // If admin, allow
    if (userRole === USER_ROLE.admin) {
      return next()
    }

    // Find user full data
    const user = await User.findById(userId)
    if (!user || user.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ====== FREE TRIAL VALIDATION ======
    const hasActiveFreeTrial =
      user.isEnabledFreeTrial &&
      user.freeTrialExpiry &&
      new Date(user.freeTrialExpiry) > today

    if (hasActiveFreeTrial) {
      return next()
    }

    // Free trial expired, check for active subscription
    const activeSubscription = await Subscription.findOne({
      user: userId,
      status: SUBSCRIPTION_STATUS.active,
      expiredAt: { $gte: today }
    })

    if (!activeSubscription) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Access denied! Your have no active subscription found.',
      )
    }

    // User has active subscription, allow
    next()
  })
}

export default checkSubscriptionAccess
