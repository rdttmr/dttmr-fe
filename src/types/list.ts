export interface List {
  id: string
  // The group the list belongs to. Every member of that group sees the list.
  group_id?: string
  name: string
  created_at?: string
  modified_at?: string
  total_items?: number
  completed_items?: number
  position?: number
}

export interface ListItem {
  id: string
  list_id: string
  title: string
  is_completed: boolean
  created_at?: string
  modified_at?: string
}

export interface CreateListPayload {
  name: string
  // Optional: the server falls back to the user's default group.
  group_id?: string
}

export interface CreateListItemPayload {
  list_id: string
  title: string
}

export interface SetListNamePayload {
  name: string
}

export interface SetListItemCompletedPayload {
  is_completed: boolean
}

export interface SetListItemTitlePayload {
  title: string
}

export interface OrderListsPayload {
  list_ids: string[]
}

export interface SetListGroupPayload {
  group_id: string
}
