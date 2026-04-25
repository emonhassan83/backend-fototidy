import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { ITag } from './tags.interface'
import { Tag } from './tags.model'
import { User } from '../user/user.model'
import { UploadPhoto } from '../uploadPhotos/uploadPhotos.model'
import { Subscription } from '../subscription/subscription.models'
import {
  SUBSCRIPTION_STATUS,
} from '../subscription/subscription.constants'

const createTagIntoDB = async (payload: ITag, userId: string) => {
  const { title } = payload

  // Ensure lowercase & trim to avoid accidental duplicates
  const normalizedTitle = title.trim().toLowerCase()

  // Check if user exists
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Author not found!')
  }

    // ===== FREE TRIAL CHECK =====
  const now = new Date();
  const isFreeTrialActive =
    user.isEnabledFreeTrial &&
    user.freeTrialExpiry &&
    new Date(user.freeTrialExpiry) > now;

  // 🔍 Check if tag already exists for this user
  let existingTag = await Tag.findOne({
    author: userId,
    title: normalizedTitle,
    isDeleted: false,
  })

  if (existingTag) {
    return existingTag
  }

  // ===== IF FREE TRIAL ACTIVE → ALLOW WITHOUT LIMIT =====
  if (!isFreeTrialActive) {
    // ===== SUBSCRIPTION CHECK =====
    const activeSubscription = await Subscription.findOne({
      user: userId,
      status: SUBSCRIPTION_STATUS.active,
      expiredAt: { $gt: new Date() },
      isDeleted: false,
    });

    // No subscription → enforce free user limit
    if (!activeSubscription) {
      const tagCount = await Tag.countDocuments({
        author: userId,
        isDeleted: false,
      });

      if (tagCount >= 5) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'Free users can create maximum 5 tags. Upgrade your plan to add more.'
        );
      }
    }
  }

  // 🆕 Create new tag
  const tag = await Tag.create({
    author: userId,
    title: normalizedTitle,
  })
  if (!tag) {
    throw new AppError(httpStatus.CONFLICT, 'Tag not created!')
  }

  return tag
}

const getAllTagsFromDB = async (query: Record<string, unknown>) => {
  const tagQuery = new QueryBuilder(Tag.find({ isDeleted: false }), query)
    .search([''])
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await tagQuery.modelQuery
  const meta = await tagQuery.countTotal()
  if (!tagQuery) {
    throw new AppError(httpStatus.NOT_FOUND, 'Tag not found!')
  }

  return {
    meta,
    result,
  }
}

const getATagFromDB = async (id: string) => {
  const result = await Tag.findById(id).populate([
    { path: 'author', select: 'name photoUrl' },
  ])
  if (!result || result?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Tags not found')
  }

  return result
}

const updateTagFromDB = async (id: string, payload: Partial<ITag>) => {
  const tag = await Tag.findById(id)
  if (!tag || tag?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Tag not found')
  }

  // If updating the title, normalize it
  if (payload.title) {
    payload.title = payload.title.trim().toLowerCase()
  }

  const updatedTag = await Tag.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  })

  if (!updatedTag) {
    throw new AppError(httpStatus.NOT_FOUND, 'Tag not updated')
  }

  return updatedTag
}

const transferTagPhotos = async (
  fromTagId: string,
  payload: { tag: string },
) => {
  const { tag: toTagId } = payload

  // Validate source tag
  const fromTag = await Tag.findById(fromTagId)
  if (!fromTag || fromTag.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Source tag not found')
  }

  // Validate destination tag
  const toTag = await Tag.findById(toTagId)
  if (!toTag || toTag.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Destination tag not found')
  }

  // Update all photos from source tag -> destination tag
  const result = await UploadPhoto.updateMany(
    { tag: fromTagId },
    { tag: toTagId },
  )
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Tags photos transfer failed!')
  }

  return result
}

const deleteATagFromDB = async (id: string) => {
  try {
    const tag = await Tag.findById(id);

    if (!tag || tag?.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Tag not found!');
    }

    // Soft delete tag
    const result = await Tag.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!result) {
      throw new AppError(httpStatus.NOT_FOUND, 'Tags delete failed!');
    }

    // Retrieve photos linked to this tag
    const photos = await UploadPhoto.find({ tag: id });

    // Total storage to deduct
    const totalSize = photos.reduce((sum, p) => sum + (p.fileSize || 0), 0);

    // Delete all photos of this tag
    await UploadPhoto.deleteMany({ tag: id });

    // Deduct all file sizes from the user
    if (totalSize > 0) {
      await User.findByIdAndUpdate(
        tag.author,
        [
          {
            $set: {
              freeStorage: {
                $max: [0, { $subtract: ['$freeStorage', totalSize] }]
              }
            }
          }
        ],
        { new: true }
      );
    }

    return result;
  } catch (error: any) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Tag deletion failed: ${error.message}`
    );
  }
};

export const TagService = {
  createTagIntoDB,
  getAllTagsFromDB,
  getATagFromDB,
  updateTagFromDB,
  transferTagPhotos,
  deleteATagFromDB,
}
