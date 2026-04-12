import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { TagService } from './tags.service'

const createTag = catchAsync(async (req, res) => {
  const result = await TagService.createTagIntoDB(req.body, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Tag created successfully!',
    data: result,
  })
})

const getAllTags = catchAsync(async (req, res) => {
  req.query['author'] = req.user._id.toString()
  const result = await TagService.getAllTagsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Tags retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getATag = catchAsync(async (req, res) => {
  const result = await TagService.getATagFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Tag retrieved successfully!',
    data: result,
  })
})

const updateTag = catchAsync(async (req, res) => {
  const result = await TagService.updateTagFromDB(
    req.params.id,
    req.body,
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Tag updated successfully!',
    data: result,
  })
})

const transferTagPhotos = catchAsync(async (req, res) => {
  const result = await TagService.transferTagPhotos(
    req.params.id,
    req.body,
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Tag photos transfer successfully!',
    data: result,
  })
})

const deleteATag = catchAsync(async (req, res) => {
  const result = await TagService.deleteATagFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Tag deleted successfully!',
    data: result,
  })
})

export const TagControllers = {
  createTag,
  getAllTags,
  getATag,
  updateTag,
  transferTagPhotos,
  deleteATag,
}
