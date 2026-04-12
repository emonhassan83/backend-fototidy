import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TUploadMultiplePhotos, TUploadPhoto } from './uploadPhotos.interface'
import { UploadPhoto } from './uploadPhotos.model'
import { User } from '../user/user.model'
import { Contents } from '../contents/contents.models'
import { Tag } from '../tags/tags.model'
import { checkProPremiumAccess } from './uploadPhotos.utils'
import { Favorite } from '../favorite/favorite.model'
import { endOfDay, startOfDay } from 'date-fns'
import mongoose from 'mongoose'
import { isFreeTrialActive } from '../../utils/checkFreeTrialActive'
import { Subscription } from '../subscription/subscription.models'
import {
  SUBSCRIPTION_STATUS,
} from '../subscription/subscription.constants'

// Single Photo Upload - Now supports multiple tags
const createUploadPhotoIntoDB = async (
  payload: TUploadPhoto,
  userId: string,
) => {
  const { tag: tagIds, fileSize } = payload

  // 1. Validate User
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // 2. Validate Tags (now array)
  const tagIdsArray = Array.isArray(tagIds) ? tagIds : [tagIds]

  if (tagIdsArray.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'At least one tag is required!')
  }

  // Validate all tags exist and belong to user
  const tags = await Tag.find({
    _id: { $in: tagIdsArray },
    author: userId,
    isDeleted: false,
  })

  if (tags.length !== tagIdsArray.length) {
    throw new AppError(httpStatus.NOT_FOUND, 'One or more tags not found!')
  }

  // 3. Determine User Access
  const now = new Date()

  const isPaidUser = user.packageExpiry && new Date(user.packageExpiry) > now

  const isFreeTrialUser =
    user.isEnabledFreeTrial &&
    user.freeTrialExpiry &&
    new Date(user.freeTrialExpiry) > now

  const hasUnlimitedAccess = isPaidUser || isFreeTrialUser

  // 4. Storage Limit Check (Only for Free Tier)
  if (!hasUnlimitedAccess) {
    const content = await Contents.findOne({ isDeleted: false })
    if (!content) {
      throw new AppError(httpStatus.NOT_FOUND, 'System content not found!')
    }

    if (typeof user.freeStorage !== 'number' || isNaN(user.freeStorage)) {
      user.freeStorage = 0
    }

    const newStorage = Number((user.freeStorage + fileSize).toFixed(4))

    if (newStorage > content.freeStorage) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `You have reached your free storage limit (${content.freeStorage} MB). Please upgrade your plan.`,
      )
    }

    // Update user's free tier usage
    user.freeStorage = newStorage
    await user.save()
  }

  // 5. Assign author and tags
  payload.author = user._id
  payload.tag = tagIdsArray // Now array

  // 6. Create Upload Record
  const uploadPhoto = await UploadPhoto.create(payload)
  if (!uploadPhoto) {
    throw new AppError(httpStatus.CONFLICT, 'Photo record not created!')
  }

  return uploadPhoto
}

// Batch Upload - Now supports multiple tags per photo
const batchUploadPhotoIntoDB = async (
  payload: TUploadMultiplePhotos,
  userId: string,
) => {
  const { data } = payload

  // 1️⃣ Validate user
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const freeTrial = isFreeTrialActive(user)

  // 2️⃣ Validate incoming data
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'No photo data provided!')
  }

  // 3️⃣ If upload more than 5 → must have Pro Premium or Free Trial
  if (data.length > 5) {
    await checkProPremiumAccess(user)
  }

  // 4️⃣ Fetch system storage configuration
  const content = await Contents.findOne({ isDeleted: false })
  if (!content || typeof content.freeStorage !== 'number') {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Invalid system storage configuration',
    )
  }

  let totalNewSize = 0
  const uploadedDocs = []

  if (typeof user.freeStorage !== 'number' || isNaN(user.freeStorage)) {
    user.freeStorage = 0
  }

  // 5️⃣ Loop through photos
  for (const item of data) {
    const { tag, image, fileSize } = item

    // Validate tags (now can be array)
    const tagIdsArray = Array.isArray(tag) ? tag : [tag]

    if (tagIdsArray.length === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'At least one tag is required per photo!',
      )
    }

    // Validate all tags exist and belong to user
    const tags = await Tag.find({
      _id: { $in: tagIdsArray },
      author: userId,
      isDeleted: false,
    })

    if (tags.length !== tagIdsArray.length) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        `One or more tags not found for a photo.`,
      )
    }

    const fileSizeMB = Number(fileSize.toFixed(4))

    // 6️⃣ STORAGE RULES
    const activeSubscription = await Subscription.findOne({
      user: userId,
      status: SUBSCRIPTION_STATUS.active,
      isDeleted: false,
    })

    const unlimitedStorage = freeTrial || (activeSubscription ? true : false)

    if (!unlimitedStorage) {
      const predictedUsage = Number(
        (user.freeStorage + totalNewSize + fileSizeMB).toFixed(4),
      )

      if (predictedUsage > content.freeStorage) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Uploading this photo exceeds your free storage limit (${content.freeStorage} MB). Please upgrade your plan.`,
        )
      }
    }

    // Save photo with multiple tags
    const newPhoto = await UploadPhoto.create({
      author: userId,
      tag: tagIdsArray, // Now array
      image,
      fileSize: fileSizeMB,
    })

    uploadedDocs.push(newPhoto)
    totalNewSize += fileSizeMB
  }

  // 7️⃣ Update free storage only for free users
  if (!isFreeTrialActive(user)) {
    const activeSubscription = await Subscription.findOne({
      user: userId,
      status: SUBSCRIPTION_STATUS.active,
      isDeleted: false,
    })
    if (!activeSubscription) {
      user.freeStorage = Number((user.freeStorage + totalNewSize).toFixed(4))
      await user.save()
    }
  }

  return uploadedDocs
}

// Get All Photos - Fixed tag filter to work with array
const getAllUploadPhotosFromDB = async (
  query: Record<string, unknown>,
  userId: string,
) => {
  const { tag, isFavorite, date, author } = query
  const filter: any = {}

  // 0️⃣ Author filter
  if (author) {
    if (mongoose.Types.ObjectId.isValid(author.toString())) {
      filter.author = new mongoose.Types.ObjectId(author.toString())
    }
  }

  // 1️⃣ Tag filter - Now works with array of tags
  if (tag) {
    let tagDoc = null

    if (mongoose.Types.ObjectId.isValid(tag.toString())) {
      tagDoc = await Tag.findOne({ _id: tag, isDeleted: false })
    } else {
      tagDoc = await Tag.findOne({ title: tag.toString(), isDeleted: false })
    }

    if (tagDoc) {
      // Use $in operator to find photos that have this tag in their tag array
      filter.tag = { $in: [tagDoc._id] }
    } else {
      return {
        meta: { page: 1, limit: 10, total: 0, totalPage: 0 },
        result: [],
      }
    }
  }

  // 2️⃣ Date filter (YYYY-MM-DD)
  if (date) {
    const [year, month, day] = (date as string).split('-').map(Number)
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const parsedDate = new Date(year, month - 1, day)
      filter.createdAt = {
        $gte: startOfDay(parsedDate),
        $lte: endOfDay(parsedDate),
      }
    }
  }

  // 3️⃣ Build query - populate all tags
  const uploadPhotoQuery = new QueryBuilder(
    // @ts-ignore
    UploadPhoto.find(filter),
    query,
  )
    .sort()
    .paginate()
    .fields()

  const result = await uploadPhotoQuery.modelQuery
  const meta = await uploadPhotoQuery.countTotal()

  // 4️⃣ Fetch favorites
  const favoritePhotos = await Favorite.find({ user: userId }).select('photo')
  const favoritePhotoIds = favoritePhotos.map((f) => f.photo.toString())

  // 5️⃣ Add isFavorite
  let resultWithFav = result.map((photo: any) => ({
    ...photo.toObject(),
    isFavorite: favoritePhotoIds.includes(photo._id.toString()),
  }))

  // 6️⃣ Filter favorites if needed
  if (isFavorite === 'true') {
    resultWithFav = resultWithFav.filter((p) => p.isFavorite)
  } else if (isFavorite === 'false') {
    resultWithFav = resultWithFav.filter((p) => !p.isFavorite)
  }

  return {
    meta,
    result: resultWithFav,
  }
}

const getAUploadPhotosFromDB = async (id: string, userId: string) => {
  const uploadPhoto = await UploadPhoto.findById(id).populate([
    { path: 'author', select: 'name email photoUrl' },
  ])
  if (!uploadPhoto) {
    throw new AppError(httpStatus.NOT_FOUND, 'Upload Photo record not found')
  }

  // Check if this photo is favorite by user
  const isFav = await Favorite.exists({ user: userId, photo: id })

  return {
    ...uploadPhoto.toObject(),
    isFavorite: !!isFav,
  }
}

const updateUploadPhotoFromDB = async (
  id: string,
  payload: Partial<TUploadPhoto>,
) => {
  const uploadPhoto = await UploadPhoto.findById(id)
  if (!uploadPhoto) {
    throw new AppError(httpStatus.NOT_FOUND, 'Upload Photo record not found')
  }

  const user = await User.findById(uploadPhoto.author)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const updatedUploadPhoto = await UploadPhoto.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!updatedUploadPhoto) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Upload Photo record not updated',
    )
  }

  return updatedUploadPhoto
}

const deleteAUploadPhotoFromDB = async (id: string) => {
  try {
    // Find photo record
    const uploadPhoto = await UploadPhoto.findById(id)
    if (!uploadPhoto) {
      throw new AppError(httpStatus.NOT_FOUND, 'Upload Photo record not found')
    }

    const fileSize = uploadPhoto.fileSize || 0

    // Delete the photo document
    const result = await UploadPhoto.findByIdAndDelete(id)
    if (!result) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Upload Photo record delete failed',
      )
    }

    // Deduct freeStorage using pipeline update (safe & non-negative)
    await User.findByIdAndUpdate(
      uploadPhoto.author,
      [
        {
          $set: {
            freeStorage: {
              $max: [0, { $subtract: ['$freeStorage', fileSize] }],
            },
          },
        },
      ],
      { new: true },
    )

    return result
  } catch (error: any) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Photo deletion failed: ${error.message}`,
    )
  }
}

export const UploadPhotoService = {
  createUploadPhotoIntoDB,
  batchUploadPhotoIntoDB,
  getAllUploadPhotosFromDB,
  getAUploadPhotosFromDB,
  updateUploadPhotoFromDB,
  deleteAUploadPhotoFromDB,
}
