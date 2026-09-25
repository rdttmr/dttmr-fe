export interface Group {
  id: string
  name: string
  // Where lists/recipes created without an explicit group_id end up.
  is_default?: boolean
  member_count?: number
  created_at?: string
  modified_at?: string
}

export interface GroupMember {
  id: string
  name: string
  email: string
  created_at?: string
}

export interface GroupInvite {
  id: string
  group_id: string
  code: string
  created_at?: string
  expires_at?: string
}

export interface CreateGroupPayload {
  name: string
}

export interface SetGroupNamePayload {
  name: string
}
