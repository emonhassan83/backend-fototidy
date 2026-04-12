import { Schema, model } from 'mongoose'
import { ITag, ITagModel } from './tags.interface'

const tagSchema = new Schema<ITag>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

export const Tag = model<ITag, ITagModel>('Tag', tagSchema)
