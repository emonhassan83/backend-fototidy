export const SUBSCRIPTION_STATUS = {
  active: 'active',
  expired: 'expired',
  cancelled: 'cancelled',
  grace_period: 'grace_period',
} as const

export type TSubscriptionStatus = keyof typeof SUBSCRIPTION_STATUS
