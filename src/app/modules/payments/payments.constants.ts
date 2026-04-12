export const PAYMENT_STATUS = {
  unpaid: 'unpaid',
  paid: 'paid',
  failed: 'failed',
  refunded: 'refunded',
} as const

export type TPaymentStatus = keyof typeof PAYMENT_STATUS
