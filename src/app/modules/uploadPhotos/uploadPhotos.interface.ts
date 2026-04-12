import { Model, Types } from 'mongoose'

export type TUploadPhoto = {
  _id?: string
  author: Types.ObjectId
  tag: Types.ObjectId[]
  image: string
  fileSize: number
}

export type TUploadMultiplePhotos = {
  _id?: string
  author: Types.ObjectId
  data: {
    tag: Types.ObjectId
    image: string
    fileSize: number
  }[]
}

export type TUploadPhotoModel = Model<TUploadPhoto, Record<string, unknown>>
