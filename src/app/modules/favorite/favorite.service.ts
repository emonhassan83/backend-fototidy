import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TFavorite } from './favorite.interface'
import { Favorite } from './favorite.model'
import { User } from '../user/user.model'
import { UploadPhoto } from '../uploadPhotos/uploadPhotos.model'

const createFavoriteIntoDB = async (payload: TFavorite) => {
  const { user: userId, photo: contentId } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !')
  }

  //* checking if the user is blocked
  if (user?.status === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked ! !')
  }

  const content = await UploadPhoto.findOne({ _id: contentId, author: userId })
  if (!content) {
    throw new AppError(httpStatus.NOT_FOUND, 'This content is not found !')
  }

  // Check if the user has already added this content to watch later
  const existingFavorite = await Favorite.findOne({
    user: userId,
    photo: contentId,
  })
  if (existingFavorite) {
    return existingFavorite
  }

  const favorite = await Favorite.create(payload)
  if (!favorite) {
    throw new AppError(httpStatus.CONFLICT, 'Watch Later not created!')
  }

  return favorite
}

const getAllFavoriteFromDB = async (query: Record<string, unknown>) => {
  const favoriteQuery = new QueryBuilder(
    Favorite.find().populate([
      { path: 'photo', select: '_id image createdAt' },
    ]),
    query,
  )
    .search([''])
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await favoriteQuery.modelQuery
  const meta = await favoriteQuery.countTotal()
  if (!favoriteQuery) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite not found!')
  }

  return {
    meta,
    result,
  }
}

const getAFavoriteFromDB = async (id: string) => {
  const result = await Favorite.findById(id).populate([
    { path: 'user', select: 'name email photoUrl' },
    {
      path: 'photo',
      select: 'image createdAt'
    },
  ])
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite not found')
  }

  return result
}

const updateFavoriteFromDB = async (id: string, payload: any) => {
  const favorite = await Favorite.findById(id)
  if (!favorite) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite not found')
  }

  const updateFavorite = await Favorite.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!updateFavorite) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite not updated')
  }

  return updateFavorite
}

const deleteAFavoriteFromDB = async (id: string) => {
  const favorite = await Favorite.findById(id)
  if (!favorite) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite not found')
  }

  const result = await Favorite.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite photo deleted failed')
  }

  return result
}

const deleteByPhotoIdFromDB = async (photoId: string) => {
  const favorite = await Favorite.findOne({ photo: photoId })
  if (!favorite) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite not found')
  }

  const result = await Favorite.findByIdAndDelete(favorite.id)
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite photo deleted failed')
  }

  return result
}

export const FavoriteService = {
  createFavoriteIntoDB,
  getAllFavoriteFromDB,
  getAFavoriteFromDB,
  updateFavoriteFromDB,
  deleteAFavoriteFromDB,
  deleteByPhotoIdFromDB,
}
