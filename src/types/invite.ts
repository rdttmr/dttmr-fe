export interface Invite {
  id: string
  code: string
  expires_at?: string
  consumed_at?: string
}

export interface PaginatedInvites {
  data: Invite[]
  total: number
  count: number
}

export interface InviteStatusCounts {
  active: number
  expired: number
  used: number
}
