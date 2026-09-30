// As listed by GET /user/invites. The server only stores a hash of the code,
// so the list can't show it; the raw code is returned once, on creation.
export interface Invite {
  id: string
  // Name of the user who registered with this invite; absent while unused.
  used_by?: string
  expires_at?: string
  consumed_at?: string
}

export interface CreatedInvite extends Invite {
  code: string
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
