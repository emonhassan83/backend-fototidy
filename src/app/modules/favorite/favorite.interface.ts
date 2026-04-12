import { Model, Types } from 'mongoose'

export type TFavorite = {
  _id?: string
  user: Types.ObjectId
  photo: Types.ObjectId
}

export type TFavoriteModel = Model<TFavorite, Record<string, unknown>>
