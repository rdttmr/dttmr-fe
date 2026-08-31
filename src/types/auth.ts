export interface LoginPayload {
  email: string
  password: string
}

export interface RefreshPayload {
  refresh_token: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
}

export interface AccessTokenClaims {
  user_id: string
  email: string
  name: string
  exp: number
}

export interface ChangePasswordPayload {
  old_password: string
  new_password: string
}
