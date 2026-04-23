import { Router } from 'express'
import { subscriptionController } from './subscription.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { subscriptionValidation } from './subscription.validation'

const router = Router()

router.post(
  '/verify',
  // zodValidationRequest(subscriptionValidation.verifyValidationSchema),
  subscriptionController.verifySubscription,
)
router.post(
  '/webhook/apple',
  subscriptionController.handleAppleServerNotification,
)

router.delete(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.user),
  subscriptionController.deleteSubscription,
)

router.patch(
  '/cancelled',
  auth(USER_ROLE.user),
  subscriptionController.chancelSubscription,
)

router.get(
  '/my-subscriptions',
  auth(USER_ROLE.user),
  subscriptionController.getMySubscription,
)

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE?.user),
  subscriptionController.getSubscriptionById,
)

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE?.user),
  subscriptionController.getAllSubscription,
)

export const SubscriptionRoutes = router
