import { Model, Types } from 'mongoose'

export type ITag = {
  _id?: string
  author: Types.ObjectId
  title: string
  isDeleted: boolean
}

export type ITagModel = Model<ITag, Record<string, unknown>>
