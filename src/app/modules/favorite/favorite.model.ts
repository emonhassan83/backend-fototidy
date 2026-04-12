import { Schema, model } from 'mongoose'
import { TFavorite, TFavoriteModel } from './favorite.interface'

const favoriteSchema = new Schema<TFavorite>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    photo: {
      type: Schema.Types.ObjectId,
      ref: 'UploadPhoto',
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

export const Favorite = model<TFavorite, TFavoriteModel>(
  'Favorite',
  favoriteSchema,
)
