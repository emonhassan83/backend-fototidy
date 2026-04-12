import config from '../config'
import { Contents } from '../modules/contents/contents.models'
import { Package } from '../modules/package/package.model'
import { USER_ROLE } from '../modules/user/user.constant'
import { User } from '../modules/user/user.model'
import { findAdmin } from '../utils/findAdmin'
import { defaultPackages } from '../utils/seedData'

const adminUser = {
  name: 'Dnoordhoff',
  email: 'dirckn@gmail.com',
  password: config.admin_pass,
  role: USER_ROLE.admin,
  verification: {
    otp: '0',
    status: true,
  },
  expireAt: null,
}

// Function to seed admin
const seedAdmin = async () => {
  //when database is connected, we will check is there any user who is admin
  const isAdminExits = await User.findOne({ role: USER_ROLE.admin })

  if (!isAdminExits) {
    await User.create(adminUser)
    console.log('\n✅ Admin User Seeded Successfully!')
  }
}

// Function to seed Contents
const seedContents = async () => {
  const admin = await findAdmin()
  const existingContents = await Contents.countDocuments()

  if (existingContents === 0) {
    await Contents.create({
      aboutUs: '',
      termsAndConditions: '',
      privacyPolicy: '',
      supports: '',
      faq: '',
      freeStorage: 512,
      createdBy: admin?._id,
    })

    console.log('\n✅Default Contents seeded successfully!')
  }
}

const seedPackages = async () => {
  for (const pkg of defaultPackages) {
    const isExist = await Package.findOne({
      title: pkg.title,
      type: pkg.type,
      billingCycle: pkg.billingCycle,
      isDeleted: false,
    })

    if (!isExist) {
      await Package.create(pkg)
      console.log(
        `✅ Package seeded: ${pkg.title} (${pkg.billingCycle})`,
      )
    } else {
      console.log(
        `⏭️ Package exists, skipped: ${pkg.title} (${pkg.billingCycle})`,
      )
    }
  }
}

export const seeder = {
  seedContents,
  seedAdmin,
  seedPackages
}
