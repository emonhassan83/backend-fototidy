import AppError from "../../errors/AppError";
import { isFreeTrialActive } from "../../utils/checkFreeTrialActive";
import { SUBSCRIPTION_STATUS } from "../subscription/subscription.constants";
import { Subscription } from "../subscription/subscription.models";
import httpStatus from 'http-status'
import { User } from "../user/user.model";

export const checkProPremiumAccess = async (user: any) => {
  // 1. Free Trial থাকলে allow করুন
  if (isFreeTrialActive(user)) {
    return true;
  }

  // 2. Active Subscription খুঁজুন
  const activeSub = await Subscription.findOne({
    user: user._id,
    status: SUBSCRIPTION_STATUS.active,
    isDeleted: false,
    expiredAt: { $gt: new Date() },   // এখনো expired হয়নি
  }).lean();

  if (!activeSub) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You have no active subscription. Please upgrade your plan.'
    );
  }

  // 3. Entitlement দিয়ে Pro চেক করুন
  const entitlement = activeSub.entitlement?.toLowerCase();
  const isProUser = entitlement === 'pro' || entitlement === 'pro_year';

  if (!isProUser) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'This feature is only available for Pro Premium users. Please upgrade your plan.'
    );
  }

  return true;
};

export const hasUnlimitedAccess = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) return false;

  const now = new Date();

  // Free Trial check
  if (user.isEnabledFreeTrial && user.freeTrialExpiry && new Date(user.freeTrialExpiry) > now) {
    return true;
  }

  // Active subscription check
  const activeSub = await Subscription.findOne({
    user: userId,
    status: SUBSCRIPTION_STATUS.active,
    expiredAt: { $gt: now },
    isDeleted: false,
  });

  return !!activeSub;
};
