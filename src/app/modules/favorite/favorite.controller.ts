import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { FavoriteService } from './favorite.service'

const createFavorite = catchAsync(async (req, res) => {
  const result = await FavoriteService.createFavoriteIntoDB(req.body)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Favorite photo added successfully!',
    data: result,
  })
})

const getMyFavorite = catchAsync(async (req, res) => {
  req.query['user'] = req?.user?._id
  const result = await FavoriteService.getAllFavoriteFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'My Favorite photo retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getAFavorite = catchAsync(async (req, res) => {
  const result = await FavoriteService.getAFavoriteFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Favorite photo retrieved successfully!',
    data: result,
  })
})

const deleteAFavorite = catchAsync(async (req, res) => {
  const result = await FavoriteService.deleteAFavoriteFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Favorite photo delete successfully!',
    data: result,
  })
})

const deleteByPhoto = catchAsync(async (req, res) => {
  const result = await FavoriteService.deleteByPhotoIdFromDB(req.params.photoId)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Favorite photo delete successfully!',
    data: result,
  })
})

export const FavoriteControllers = {
  createFavorite,
  getMyFavorite,
  getAFavorite,
  deleteAFavorite,
  deleteByPhoto
}
