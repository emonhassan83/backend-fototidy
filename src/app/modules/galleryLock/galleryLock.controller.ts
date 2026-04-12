import httpStatus from 'http-status'
import catchAsync from '../../utils/catchAsync'
import sendResponse from '../../utils/sendResponse'
import { JournalLockServices } from './galleryLock.service'

const addToNewKey = catchAsync(async (req, res) => {
  const result = await JournalLockServices.addJournalKey(req.body, req?.user._id)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gallery lock added successfully!',
    data: result,
  })
})

const accessJournal = catchAsync(async (req, res) => {
  const result = await JournalLockServices.accessJournal(req.body, req?.user._id)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gallery lock access successfully!',
    data: result,
  })
})

const lockGallery = catchAsync(async (req, res) => {
  const result = await JournalLockServices.removeAccessLock(req?.user._id)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gallery lock successfully!',
    data: result,
  })
})

const changeKey = catchAsync(async (req, res) => {
  const result = await JournalLockServices.changeKey(req.body,  req?.user._id)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gallery lock updated successfully!',
    data: result,
  })
})

const deleteKey = catchAsync(async (req, res) => {
  const result = await JournalLockServices.deleteJournalKey(req.body, req?.user._id)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gallery lock deleted successfully!',
    data: result,
  })
})

export const JournalLockControllers = {
  addToNewKey,
  accessJournal,
  lockGallery,
  changeKey,
  deleteKey,
}
