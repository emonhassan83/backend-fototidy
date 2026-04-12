export const durationType = {
  monthly: 'monthly',
  yearly: 'yearly',
}

export const PACKAGE_TYPE = {
  core: 'core',
  pro: 'pro'
 } as const

export type TPackageType = keyof typeof PACKAGE_TYPE
export type TDurationType = keyof typeof durationType

export const PackageSearchableFields = ['id', 'title']
