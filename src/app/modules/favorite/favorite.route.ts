import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { FavoriteControllers } from './favorite.controller'
import { FavoriteValidation } from './favorite.validation'
import checkSubscriptionAccess from '../../middleware/checkSubscription'

const router = express.Router()

router.post(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.user),
  checkSubscriptionAccess(),
  zodValidationRequest(FavoriteValidation.createValidationSchema),
  FavoriteControllers.createFavorite,
)

router.delete(
  '/photo/:photoId',
  auth(USER_ROLE.admin, USER_ROLE.user),
  checkSubscriptionAccess(),
  FavoriteControllers.deleteByPhoto,
)

router.delete(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.user),
  checkSubscriptionAccess(),
  FavoriteControllers.deleteAFavorite,
)

router.get(
  '/my-favorite',
  auth(USER_ROLE.admin, USER_ROLE.user),
  checkSubscriptionAccess(),
  FavoriteControllers.getMyFavorite,
)

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.user),
  checkSubscriptionAccess(),
  FavoriteControllers.getAFavorite,
)

export const FavoriteRoutes = router
