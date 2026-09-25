export interface Group {
  id: string
  name: string
  // Where lists/recipes created without an explicit group_id end up.
  is_default?: boolean
  member_count?: number
  // The current user's role in this group: 'owner' or 'member'.
  role?: string
  created_at?: string
  modified_at?: string
}

export interface GroupMember {
  id: string
  name: string
  email: string
  // 'owner' for the creator, 'member' for everyone who joined via a share code.
  role?: string
  // When the member joined the group.
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
