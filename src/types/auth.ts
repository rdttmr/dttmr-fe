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
