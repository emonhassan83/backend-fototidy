import { Schema, model } from 'mongoose'
import { TUploadPhoto, TUploadPhotoModel } from './uploadPhotos.interface'

const uploadPhotosSchema = new Schema<TUploadPhoto>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tag: { type: [Schema.Types.ObjectId], ref: 'Tag', required: true },
    image: { type: String, required: true },
    fileSize: { type: Number, required: true },
  },
  {
    timestamps: true,
  },
)

export const UploadPhoto = model<TUploadPhoto, TUploadPhotoModel>(
  'UploadPhoto',
  uploadPhotosSchema,
)
