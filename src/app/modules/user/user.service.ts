import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { TUser } from './user.interface'
import { User } from './user.model'
import QueryBuilder from '../../builder/QueryBuilder'
import { USER_ROLE, UserSearchableFields } from './user.constant'
import { sendUserStatusNotifYToUser } from './user.utils'
import { Tag } from '../tags/tags.model'
import { Contents } from '../contents/contents.models'
import { Subscription } from '../subscription/subscription.models'
import { SUBSCRIPTION_STATUS } from '../subscription/subscription.constants'
import cron from 'node-cron'
import { runFreeTrialCron } from '../../utils/runFreeTrialCron'
import mongoose from 'mongoose'

// Schedule the cron job to run daily at midnight
export const initiateFreeTrialCronJob = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('Running daily Free Trial CRON...')
    await runFreeTrialCron()
  })
}

// Helper function
const ensureDefaultTags = async (userId: string) => {
  const defaultTags = ['family', 'pet', 'travel']

  for (const tag of defaultTags) {
    const exists = await Tag.findOne({ author: userId, title: tag })
    if (!exists) {
      await Tag.create({ author: userId, title: tag })
    }
  }
}

const registerUserIntoDB = async (payload: TUser) => {
  if (payload.role === 'admin') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You cannot directly assign admin role',
    )
  }

  const existingUser = await User.findOne({ email: payload.email })
  if (existingUser) {
    // 🟡 Soft deleted user — recreate
    if (existingUser.isDeleted) {
      existingUser.set({ ...payload, isDeleted: false })
      const user = await existingUser.save()
      return user
    }

    // 🟡 Unverified user — update fields and re-save
    if (!existingUser.verification?.status) {
      existingUser.set({ ...payload })
      const user = await existingUser.save()
      return user
    }

    // 🔴 Already active user
    throw new AppError(
      httpStatus.FORBIDDEN,
      'User already exists with this email',
    )
  }

  // 🟢 New user
  if (!payload.password) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password is required')
  }

  const newUser = new User(payload)
  await newUser.save()

  // ✅ Create default tags safely
  await ensureDefaultTags(newUser._id.toString())

  return newUser
}

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const usersQuery = new QueryBuilder(
    User.find({ isDeleted: false, role: { $ne: USER_ROLE.admin } }).select(
      '_id id name email photoUrl contractNumber status createdAt',
    ),
    query,
  )
    .search(UserSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await usersQuery.modelQuery
  const meta = await usersQuery.countTotal()

  if (!usersQuery) {
    throw new AppError(httpStatus.NOT_FOUND, 'Users not found!')
  }

  return {
    meta,
    result,
  }
}

const geUserByIdFromDB = async (id: string) => {
  const user = await User.findOne({ _id: id })
    .select('_id id name email photoUrl contractNumber freeStorage status isActiveLock isEnabledFreeTrial freeTrialExpiry createdAt galleryKey isDeactivateLock packageExpiry')
    .lean();

  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const content = await Contents.findOne({ isDeleted: false }).select('freeStorage').lean();
  const storageLimit = content?.freeStorage ?? 0;

  const formattedFreeStorage = user.freeStorage ? Number(user.freeStorage.toFixed(1)) : 0;

  const today = new Date();
  const activeSubscription = await Subscription.findOne({
    user: id,
    status: SUBSCRIPTION_STATUS.active,
    isDeleted: false,
    expiredAt: { $gt: today },
  })
    .select('entitlement productId expiredAt')
    .lean();

  const isActiveSubscription = !!activeSubscription;

  let subscriptionType: 'core' | 'pro' | null = null;
  let isProUser = false;

  if (activeSubscription) {
    const identifier = (activeSubscription.productId || '').toLowerCase().trim();

    if (identifier === 'pro' || identifier === 'pro_year') {
      subscriptionType = 'pro';
      isProUser = true;
    } else if (identifier === 'core' || identifier === 'core_year') {
      subscriptionType = 'core';
    }
  }

  const isGalleryLock = !!user.galleryKey;
  const isActiveFreeTrial = 
    user.isEnabledFreeTrial && 
    user.freeTrialExpiry && 
    new Date(user.freeTrialExpiry) > today;

  return {
    ...user,
    freeStorage: formattedFreeStorage,
    storageLimit,
    isActiveSubscription,
    subscriptionType,            // 👈 নতুন field
    subscriptionExpiry: activeSubscription?.expiredAt || null, // 👈 expiry date return করো
    isProUser,                   // 👈 pro user flag
    isGalleryLock,
    isActiveFreeTrial,
  };
};

const changeUserStatusFromDB = async (payload: any) => {
  const { userId, status } = payload

  //* if the user is is not exist
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const updateUserStatus = await User.findByIdAndUpdate(
    userId,
    { status },
    { new: true },
  ).select('_id id name email photoUrl contractNumber status fcmToken')
  if (!updateUserStatus) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found and failed to update status!',
    )
  }

  // Send notification to both user and admin
  await sendUserStatusNotifYToUser(status, updateUserStatus)

  return updateUserStatus
}

const changedActiveLock = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const result = await User.findByIdAndUpdate(
    userId,
    { isActiveLock: true },
    { new: true },
  ).select('_id id name email photoUrl contractNumber status isActiveLock')
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found and failed to update status!',
    )
  }

  return result
}

/**
 * Toggles the gallery/account deactivation lock after verifying the PIN.
 * - Requires correct gallery PIN (key)
 * - Toggles isDeactivateLock (true = locked / protected, false = unlocked)
 * - Always resets isActiveLock to false (as per your requirement)
 * - Atomic operation with transaction
 */
const toggleDeactivate = async (userId: string, payload: { key: string }) => {
  const { key } = payload

  if (!key || typeof key !== 'string' || key.trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Gallery PIN is required')
  }

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const user = await User.findById(userId)
      .select(
        '_id name email photoUrl status isActiveLock isDeactivateLock galleryKey fcmToken pushNotify isGalleryLock',
      )
      .session(session)

    if (!user || user.isDeleted) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'User not found or has been deleted',
      )
    }

    if (!user.galleryKey) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Gallery PIN is not set. Please set it first.',
      )
    }

    const isPinCorrect = await User.isPasswordMatched(key, user.galleryKey)
    if (!isPinCorrect) {
      throw new AppError(httpStatus.FORBIDDEN, 'Incorrect gallery PIN')
    }

    const currentLockStatus = user.isDeactivateLock
    const newLockStatus = !currentLockStatus

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        isActiveLock: false,
        isDeactivateLock: newLockStatus,
      },
      {
        new: true,
        runValidators: true,
        session,
        select:
          '_id id name email photoUrl status isGalleryLock isDeactivateLock', // ← Fixed: added isGalleryLock
      },
    )

    if (!updatedUser) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to update deactivation lock status',
      )
    }

    await session.commitTransaction()

    return {
      success: true,
      message: newLockStatus
        ? 'Deactivation lock enabled successfully'
        : 'Deactivation lock disabled successfully',
      data: updatedUser,
    }
  } catch (error) {
    await session.abortTransaction()
    throw error instanceof AppError
      ? error
      : new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to toggle deactivation lock',
        )
  } finally {
    session.endSession()
  }
}

const enabledFreeTier = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // 1. Check if user already used the trial
  if (user.isEnabledFreeTrial) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Free trial has already been activated previously.',
    )
  }

  // 2. Check if user still has an active trial
  if (user.freeTrialExpiry && user.freeTrialExpiry > new Date()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Free trial is already active.')
  }

  // 3. Activate free trial for 7 days
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + 7)

  // Cleanup after 7 days of expiry
  const cleanupDate = new Date(expiryDate)
  cleanupDate.setDate(expiryDate.getDate() + 7) // deletion date

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      isEnabledFreeTrial: true,
      freeTrialExpiry: expiryDate,
      freeTrialCleanupDate: cleanupDate,
    },
    { new: true },
  )
  if (!updatedUser) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to activate free trial.',
    )
  }

  return updatedUser
}

const updateUserInfoFromDB = async (
  userId: string,
  payload: Partial<TUser>,
) => {
  //* if the user is is not exist
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  //* checking if the user is blocked
  if (user?.status === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked ! !')
  }
  // console.log(payload)

  const updatedUser = await User.findByIdAndUpdate(userId, payload, {
    new: true,
  }).select('_id id name email photoUrl contractNumber status')
  if (!updatedUser) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found and failed to update!',
    )
  }

  return updatedUser
}

const deleteAUserFromDB = async (userId: string) => {
  //* Check if the user exists
  const user = await User.findById(userId).select('_id')
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // Use `Promise.all` to execute updates in parallel
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { isDeleted: true },
    { new: true },
  ).select('_id id name email photoUrl contractNumber status isDeleted')

  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'Failed to update user status!')
  }

  return updatedUser
}

export const UserService = {
  registerUserIntoDB,
  getAllUsersFromDB,
  geUserByIdFromDB,
  changeUserStatusFromDB,
  changedActiveLock,
  enabledFreeTier,
  updateUserInfoFromDB,
  toggleDeactivate,
  deleteAUserFromDB,
}
