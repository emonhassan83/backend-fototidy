import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { TagControllers } from './tags.controller'
import { TagValidation } from './tags.validation'

const router = express.Router()

router.post(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.user),
  zodValidationRequest(TagValidation.createValidationSchema),
  TagControllers.createTag,
)

router.patch(
  '/transfer-photos/:id',
  auth(USER_ROLE.admin, USER_ROLE.user),
  zodValidationRequest(TagValidation.transferPhotosValidationSchema),
  TagControllers.transferTagPhotos,
)

router.put(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.user),
  zodValidationRequest(TagValidation.updateValidationSchema),
  TagControllers.updateTag,
)

router.delete(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.user),
  TagControllers.deleteATag,
)

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.user),
  TagControllers.getAllTags,
)

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.user),
  TagControllers.getATag,
)

export const TagRoutes = router
