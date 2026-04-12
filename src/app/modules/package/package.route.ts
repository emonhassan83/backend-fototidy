import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { PackageControllers } from './package.controller'
import { PackageValidation } from './package.validation'

const router = express.Router()

router.post(
  '/',
  auth(USER_ROLE.admin),
  zodValidationRequest(PackageValidation.createValidationSchema),
  PackageControllers.createPackage,
)

router.put(
  '/:id',
  auth(USER_ROLE.admin),
  zodValidationRequest(PackageValidation.updateValidationSchema),
  PackageControllers.updatePackage,
)

router.delete('/:id', auth(USER_ROLE.admin), PackageControllers.deleteAPackage)

router.get('/', PackageControllers.getAllPackages)

router.get('/:id', PackageControllers.getAPackage)

export const PackageRoutes = router
