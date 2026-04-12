import { PAYMENT_STATUS } from '../payments/payments.constants'
import { Payment } from '../payments/payments.models'
import {
  SUBSCRIPTION_STATUS,
} from '../subscription/subscription.constants'
import { Subscription } from '../subscription/subscription.models'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { User } from '../user/user.model'
import { startOfYear, endOfYear } from 'date-fns'

const fetchDashboardMetaData = async (
  user: any,
  query: Record<string, unknown>,
) => {
  if (user?.role !== USER_ROLE.admin) {
    throw new Error('Invalid user role!')
  }
  return await getAdminMetaData(query)
}

const getAdminMetaData = async (query: Record<string, unknown>) => {
  const { user_year, earning_year } = query

  const totalUserCount = await User.countDocuments({
    role: USER_ROLE.user,
    status: USER_STATUS.active,
    isDeleted: false,
  })
  const activeSubscription = await Subscription.countDocuments({
    status: SUBSCRIPTION_STATUS.active,
    isDeleted: false,
  })

  const selectedUserYear = user_year
    ? parseInt(user_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const selectedEarningYear = earning_year
    ? parseInt(earning_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  // Fetch user registration overview based on the selected year
  const userOverview = await getUserOverview(selectedUserYear)

  // Earning overview
  const { totalEarnings, earningOverview } =
    await getEarningOverview(selectedEarningYear)

  return {
    totalEarnings,
    totalUserCount,
    activeSubscription,
    userOverview,
    earningOverview,
  }
}

const getUserOverview = async (year: number) => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const isCurrentYear = year === currentYear

  const yearStart = startOfYear(new Date(year, 0, 1))
  const yearEnd = endOfYear(new Date(year, 11, 31))

  // Aggregate Monthly User Registrations
  const monthlyUsers = await User.aggregate([
    {
      $match: {
        role: USER_ROLE.user,
        createdAt: { $gte: yearStart, $lte: yearEnd },
        status: USER_STATUS.active,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const filteredMonths = isCurrentYear
    ? months.slice(0, now.getMonth() + 1)
    : months

  const userOverview = filteredMonths.map((month, index) => {
    const data = monthlyUsers.find((m: any) => m._id === index + 1)
    return { month, count: data ? data.count : 0 }
  })

  return userOverview
}

const getEarningOverview = async (year: number) => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const isCurrentYear = year === currentYear

  const yearStart = startOfYear(new Date(year, 0, 1))
  const yearEnd = endOfYear(new Date(year, 11, 31))

  // Aggregate Monthly Earnings
  const monthlyEarnings = await Payment.aggregate([
    {
      $match: {
        createdAt: { $gte: yearStart, $lte: yearEnd },
        isPaid: true,
        status: PAYMENT_STATUS.paid,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ])

  // Get total earnings
  const totalEarnings = monthlyEarnings.reduce((sum, m) => sum + m.total, 0)

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const filteredMonths = isCurrentYear
    ? months.slice(0, now.getMonth() + 1)
    : months

  const earningOverview = filteredMonths.map((month, index) => {
    const data = monthlyEarnings.find((m: any) => m._id === index + 1)
    return { month, total: data ? data.total : 0 }
  })

  return { totalEarnings, earningOverview }
}

export const MetaService = {
  fetchDashboardMetaData,
}
