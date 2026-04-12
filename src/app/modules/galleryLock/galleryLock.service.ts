import bcrypt from 'bcrypt'
import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { TAddJournalUser } from './galleryLock.interface'
import { journalNotifyToUser } from './galleryLock.utils'

const addJournalKey = async (payload: TAddJournalUser, userId: string) => {
  const { key } = payload

  // check user validity
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !')
  }

  const hashedKey = await bcrypt.hash(key, 12)
  const result = await User.findByIdAndUpdate(
    userId,
    { $set: { galleryKey: hashedKey } },
    { new: true, runValidators: true },
  )

  // notify to user when add to journal key
  await journalNotifyToUser('KEY_ADD', user)

  return result
}

const accessJournal = async (payload: TAddJournalUser, userId: string) => {
  const { key } = payload

  // check user validity
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found !')
  }

  const passwordKey = user?.galleryKey
  if (!passwordKey) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Gallery pin is missing!')
  }

  //* checking if the password is correct
  if (!(await User.isPasswordMatched(key, passwordKey)))
    throw new AppError(httpStatus.FORBIDDEN, 'Gallery pin do not matched')

  // update user isActiveLock
  await User.findByIdAndUpdate(
    user._id,
    {
      isActiveLock: false,
    },
    { new: true },
  )

  return
}

const removeAccessLock = async (userId: string) => {
  // check user validity
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found !')
  }

  // update user isActiveLock
  const result = await User.findByIdAndUpdate(
    user._id,
    {
      isActiveLock: true,
    },
    { new: true },
  )

  return
}

const changeKey = async (
  payload: { oldKey: string; newKey: string },
  userId: string,
) => {
  // check user validity
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user is not found!')
  }

  const passwordKey = user?.galleryKey
  if (!passwordKey) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password is missing')
  }

  //* Checking if the old password is correct
  const isMatch = await bcrypt.compare(payload.oldKey, passwordKey)
  if (!isMatch) {
    throw new AppError(httpStatus.FORBIDDEN, 'Password does not match')
  }

  //* Hash the new key
  const newHashedKey = await bcrypt.hash(payload.newKey, 12)

  //* Update the journal key in the database
  const updateJournalKey = await User.findByIdAndUpdate(
    user._id,
    {
      $set: { galleryKey: newHashedKey },
    },
    { new: true },
  )
  if (!updateJournalKey) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Key was not updated. Please try again!',
    )
  }

  // notify to user when change to journal key
  await journalNotifyToUser('KEY_CHANGED', user)

  return updateJournalKey
}

const deleteJournalKey = async ( payload: { key: string },userId: string) => {
  const { key } = payload;

  if (!key || typeof key !== 'string' || key.trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Gallery PIN is required');
  }

  // check user validity
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user is not found!')
  }

  if (!user.galleryKey) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Gallery PIN is not set. Please set it first.');
    }

    const isPinCorrect = await User.isPasswordMatched(key, user.galleryKey);
    if (!isPinCorrect) {
      throw new AppError(httpStatus.FORBIDDEN, 'Incorrect gallery PIN');
    }

  //* Remove the journal password key
  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    {
      $unset: { galleryKey: null },
      isActiveLock: false,
    },
    { new: true },
  )
  if (!updatedUser) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Key is not deleted. Please try again!',
    )
  }

  // notify to user when remove to journal key
  await journalNotifyToUser('KEY_REMOVED', user)

  return updatedUser
}

export const JournalLockServices = {
  addJournalKey,
  accessJournal,
  removeAccessLock,
  changeKey,
  deleteJournalKey,
}
