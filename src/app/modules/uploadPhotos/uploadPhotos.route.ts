import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { UploadPhotoControllers } from './uploadPhotos.controller'
import { UploadPhotoValidation } from './uploadPhotos.validation'
import multer, { memoryStorage } from 'multer'
import parseData from '../../middleware/parseData'

const router = express.Router()
const storage = memoryStorage()
const upload = multer({ storage })

router.post(
  '/',
  auth(USER_ROLE.user),
  zodValidationRequest(UploadPhotoValidation.createValidationSchema),
  UploadPhotoControllers.createUploadPhoto,
)

router.post(
  '/batch-upload',
  auth(USER_ROLE.user),
  zodValidationRequest(UploadPhotoValidation.multiTagsValidationSchema),
  UploadPhotoControllers.batchUploadPhoto
);

router.put(
  '/:id',
  auth(USER_ROLE.user, USER_ROLE.admin),
  upload.single('image'),
  parseData(),
  UploadPhotoControllers.updateUploadPhoto,
)

router.delete(
  '/:id',
  auth(USER_ROLE.user, USER_ROLE.admin),
  UploadPhotoControllers.deleteAUploadPhoto,
)

router.get(
  '/tags/:tagId',
  auth(USER_ROLE.user, USER_ROLE.admin),
  UploadPhotoControllers.getUploadPhotoByTagId,
)

router.get(
  '/my-photos',
  auth(USER_ROLE.user, USER_ROLE.admin),
  UploadPhotoControllers.getMyUploadPhotos,
)

router.get(
  '/:id',
  auth(USER_ROLE.user, USER_ROLE.admin),
  UploadPhotoControllers.getAUploadPhoto,
)

export const UploadPhotoRoutes = router
