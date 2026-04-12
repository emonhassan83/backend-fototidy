import { Schema, model } from 'mongoose'
import { TPackage, TPackageModel } from './package.interface'
import { durationType, PACKAGE_TYPE } from './package.constant'

const packageSchema = new Schema<TPackage>(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    type: { type: String, enum: Object.values(PACKAGE_TYPE), required: true },
    billingCycle: {
      type: String,
      enum: Object.values(durationType),
      required: true,
    },

    description: { type: [String], required: true },
    price: { type: Number, required: true },
    popularity: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

export const Package = model<TPackage, TPackageModel>('Package', packageSchema)
