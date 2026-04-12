import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TPackage } from './package.interface'
import { Package } from './package.model'
import { PackageSearchableFields } from './package.constant'

const createPackageIntoDB = async (payload: TPackage) => {
  const { type, billingCycle } = payload

  // check if a package with same type and billingCycle already exists
  const exists = await Package.findOne({
    type,
    billingCycle,
    isDeleted: false,
  })

  if (exists) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Package with type "${type}" and billing cycle "${billingCycle}" already exists!`,
    )
  }

  const pkg = await Package.create(payload)
  if (!pkg) {
    throw new AppError(httpStatus.CONFLICT, 'Package not created!')
  }

  return pkg
}

const getAllPackagesFromDB = async (query: Record<string, unknown>) => {
  const packageQuery = new QueryBuilder(
    Package.find({ isDeleted: false }),
    query,
  )
    .search(PackageSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await packageQuery.modelQuery
  const meta = await packageQuery.countTotal()
  if (!packageQuery) {
    throw new AppError(httpStatus.NOT_FOUND, 'Package not found!')
  }

  return {
    meta,
    result,
  }
}

const getAPackageFromDB = async (id: string) => {
  const result = await Package.findById(id)
  if (!result || result?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Packages not found')
  }

  return result
}

const updatePackageFromDB = async (id: string, payload: any) => {
  const packages = await Package.findById(id)
  if (!packages || packages?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Packages not found')
  }

  const updatePackage = await Package.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!updatePackage) {
    throw new AppError(httpStatus.NOT_FOUND, 'Packages not updated')
  }

  return updatePackage
}

const deleteAPackageFromDB = async (id: string) => {
  const packages = await Package.findById(id)
  if (!packages || packages?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Packages not found')
  }

  const result = await Package.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
    },
    { new: true },
  )

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Packages Delete failed!')
  }

  return result
}

export const PackageService = {
  createPackageIntoDB,
  getAllPackagesFromDB,
  getAPackageFromDB,
  updatePackageFromDB,
  deleteAPackageFromDB,
}
