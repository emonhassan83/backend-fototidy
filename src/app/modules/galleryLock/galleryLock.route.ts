import express from 'express'
import validateRequest from '../../middleware/validateRequest'
import { JournalLockControllers } from './galleryLock.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { JournalLockValidation } from './galleryLock.validation'
import checkSubscriptionAccess from '../../middleware/checkSubscription'

const router = express.Router()

router.post(
  '/add-key',
  auth(USER_ROLE.admin, USER_ROLE.user),
  checkSubscriptionAccess(),
  validateRequest(JournalLockValidation.createKeyValidationSchema),
  JournalLockControllers.addToNewKey,
)

router.post(
  '/access-journal',
  auth(USER_ROLE.admin, USER_ROLE.user),
  checkSubscriptionAccess(),
  validateRequest(JournalLockValidation.createKeyValidationSchema),
  JournalLockControllers.accessJournal,
)

router.post(
  '/locked-gallery',
  auth(USER_ROLE.admin, USER_ROLE.user),
  checkSubscriptionAccess(),
  JournalLockControllers.lockGallery,
)

router.post(
  '/change-key',
  auth(USER_ROLE.admin, USER_ROLE.user),
  checkSubscriptionAccess(),
  validateRequest(JournalLockValidation.changeKeyValidationSchema),
  JournalLockControllers.changeKey,
)

router.post(
  '/delete-key',
  auth(USER_ROLE.admin, USER_ROLE.user),
  checkSubscriptionAccess(),
  JournalLockControllers.deleteKey,
)

export const JournalKeyRoutes = router
