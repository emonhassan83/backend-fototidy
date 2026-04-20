import { Router } from 'express'
import { paymentsController } from './payments.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'

const router = Router()

router.post('/webhooks/revenuecat', paymentsController.revenueCatWebhook)

router.get(
  '/dashboard-data',
  auth(USER_ROLE.admin),
  paymentsController.dashboardData,
)

router.get(
  '/',
  auth(USER_ROLE.admin),
  paymentsController.getAllPayments
);

router.get(
  '/:id',
  auth(USER_ROLE.admin),
  paymentsController.getAPayment
);

export const paymentsRoutes = router
