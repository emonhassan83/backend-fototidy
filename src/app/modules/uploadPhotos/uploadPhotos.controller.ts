import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { UploadPhotoService } from './uploadPhotos.service'

const createUploadPhoto = catchAsync(async (req, res) => {
  const result = await UploadPhotoService.createUploadPhotoIntoDB(req.body, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Gallery photo upload successfully!',
    data: result,
  })
})

const batchUploadPhoto = catchAsync(async (req, res) => {
  const result = await UploadPhotoService.batchUploadPhotoIntoDB(req.body, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Gallery photos upload successfully!',
    data: result,
  })
})

const getMyUploadPhotos = catchAsync(async (req, res) => {
  req.query['author'] = req.user._id.toString()
  const result = await UploadPhotoService.getAllUploadPhotosFromDB(req.query, req.user._id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'My upload photos retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getUploadPhotoByTagId = catchAsync(async (req, res) => {
  req.query['tag'] = req.params.tagId
  const result = await UploadPhotoService.getAllUploadPhotosFromDB(req.query, req.user._id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Upload photos by tags retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getAUploadPhoto = catchAsync(async (req, res) => {
  const result = await UploadPhotoService.getAUploadPhotosFromDB(req.params.id, req.user._id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'A upload photo retrieved successfully!',
    data: result,
  })
})

const updateUploadPhoto = catchAsync(async (req, res) => {
  const result = await UploadPhotoService.updateUploadPhotoFromDB(
    req.params.id,
    req.body
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Upload photo update successfully!',
    data: result,
  })
})

const deleteAUploadPhoto = catchAsync(async (req, res) => {
  const result = await UploadPhotoService.deleteAUploadPhotoFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Upload photo delete successfully!',
    data: result,
  })
})

export const UploadPhotoControllers = {
  createUploadPhoto,
  batchUploadPhoto,
  getMyUploadPhotos,
  getUploadPhotoByTagId,
  getAUploadPhoto,
  updateUploadPhoto,
  deleteAUploadPhoto,
}
