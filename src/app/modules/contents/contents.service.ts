import httpStatus from 'http-status'
import { TContents } from './contents.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Contents } from './contents.models'
import AppError from '../../errors/AppError'
import { findAdmin } from '../../utils/findAdmin'

// Create a new content
const createContents = async (payload: TContents) => {
  // auto assign created by admin
  const admin = await findAdmin()
  if (admin) admin._id = payload.createdBy

  const result = await Contents.create(payload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Content creation failed')
  }

  return result
}

// Get all contents
const getAllContents = async (query: Record<string, any>) => {
  const ContentModel = new QueryBuilder(
    Contents.find().populate([
      {
        path: 'createdBy',
        select: 'name email photoUrl contactNumber status',
      },
    ]),
    query,
  )
    .search(['createdBy'])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await ContentModel.modelQuery
  const meta = await ContentModel.countTotal()
  return {
    data,
    meta,
  }
}

// Get content by ID
const getContentsById = async (id: string) => {
  const result = await Contents.findById(id).populate([
    {
      path: 'createdBy',
      select: 'name email photoUrl contactNumber status',
    },
  ])
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Content not found')
  }

  return result
}

// Update content
const updateContents = async (payload: Partial<TContents>) => {
  const content = await Contents.findOne()
  if (!content) {
    throw new AppError(httpStatus.NOT_FOUND, 'Content not found!')
  }

  // if this content deleted then throw error
  if (content?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'This content already deleted!')
  }

  // Update the content document
  Object.assign(content, payload)
  await content.save()

  // when update content then notify to admin
  // await contentNotifyToAdmin('UPDATED', content)

  return content
}

// Delete content
const deleteContents = async (id: string) => {
  const result = await Contents.findByIdAndUpdate(
    id,
    {
      $set: {
        isDeleted: true,
      },
    },
    { new: true },
  )

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Content deletion failed')
  }

  return result
}

export const contentsService = {
  createContents,
  getAllContents,
  getContentsById,
  updateContents,
  deleteContents,
}
