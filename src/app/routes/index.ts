import { Router } from 'express'
import { UserRoutes } from '../modules/user/user.route'
import { AuthRoutes } from '../modules/auth/auth.route'
import { otpRoutes } from '../modules/otp/otp.route'
import { contentsRoutes } from '../modules/contents/contents.route'
import { NotificationRoutes } from '../modules/notification/notification.route'
import { MetaRoutes } from '../modules/meta/meta.route'
import { UploadPhotoRoutes } from '../modules/uploadPhotos/uploadPhotos.route'
import { PackageRoutes } from '../modules/package/package.route'
import { SubscriptionRoutes } from '../modules/subscription/subscription.route'
import { paymentsRoutes } from '../modules/payments/payments.route'
import { FavoriteRoutes } from '../modules/favorite/favorite.route'
import { JournalKeyRoutes } from '../modules/galleryLock/galleryLock.route'
import { TagRoutes } from '../modules/tags/tags.route'
import { uploadRouter } from '../modules/uploads/route'

const router = Router()

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/gallery-lock',
    route: JournalKeyRoutes,
  },
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/otp',
    route: otpRoutes,
  },
  {
    path: '/tags',
    route: TagRoutes,
  },
  {
    path: '/upload-photos',
    route: UploadPhotoRoutes,
  },
  {
    path: '/favorite',
    route: FavoriteRoutes,
  },
  {
    path: '/packages',
    route: PackageRoutes,
  },
  {
    path: '/subscriptions',
    route: SubscriptionRoutes,
  },
  {
    path: '/payments',
    route: paymentsRoutes,
  },
    {
    path: '/uploads',
    route: uploadRouter,
  },
  {
    path: '/contents',
    route: contentsRoutes,
  },
  {
    path: '/notification',
    route: NotificationRoutes,
  },
  {
    path: '/meta',
    route: MetaRoutes,
  },
]

moduleRoutes.forEach((route) => router.use(route.path, route.route))

export default router
