export interface User {
  id: string
  email: string
  name: string
  created_at?: string
}

export interface CreateUserPayload {
  email: string
  password: string
  name: string
  invite_code: string
}
