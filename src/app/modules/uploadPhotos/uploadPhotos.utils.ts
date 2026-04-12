import AppError from "../../errors/AppError";
import { isFreeTrialActive } from "../../utils/checkFreeTrialActive";
import { SUBSCRIPTION_STATUS } from "../subscription/subscription.constants";
import { Subscription } from "../subscription/subscription.models";
import httpStatus from 'http-status'

export const checkProPremiumAccess = async (user: any) => {
  // 1. Free Trial থাকলে সবাইকে allow করুন
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
      'Now you have no active subscription. Please upgrade your plan.'
    );
  }

  // 3. Entitlement দিয়ে Pro চেক করুন (সবচেয়ে সঠিক উপায়)
  const isProUser = activeSub.entitlement === 'Foto Tidy Pro' || 
                    activeSub.entitlement?.toLowerCase().includes('pro');

  if (!isProUser) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'This feature is only available for Pro Premium users. Please upgrade your plan.'
    );
  }

  return true;
};