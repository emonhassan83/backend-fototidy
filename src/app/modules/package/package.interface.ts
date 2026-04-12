import { Model } from 'mongoose'
import { TDurationType, TPackageType } from './package.constant'

export type TPackage = {
  _id?: string
  title: string
  type: TPackageType
  subtitle?: string
  billingCycle?: TDurationType
  description: string[]
  price: number
  popularity: number
  isDeleted: boolean
}

export type TPackageModel = Model<TPackage, Record<string, unknown>>
