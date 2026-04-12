export interface TRegisterUser {
  name: string
  email: string
  password: string
  role: 'admin' | 'user'
}

export interface TLoginUser {
  email: string
  password: string
  fcmToken?: string 
}
