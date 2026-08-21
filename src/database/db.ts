import Dexie, { type Table } from 'dexie'
import type { List, ListItem } from '@/types/list'

export interface LocalList extends List {
  pendingSync?: boolean
}

export interface LocalListItem extends ListItem {
  pendingSync?: boolean
}

export type SyncOperationType =
  | 'createList'
  | 'createListItem'
  | 'updateListItem'
  | 'setListItemCompleted'
  | 'addUserToList'
  | 'removeUserFromList'

export interface SyncQueueEntry {
  id?: number
  type: SyncOperationType
  payload: unknown
  localListId?: string
  localListItemId?: string
  createdAt: number
  attempts: number
  lastError?: string
}

class AppDatabase extends Dexie {
  lists!: Table<LocalList, string>
  listItems!: Table<LocalListItem, string>
  syncQueue!: Table<SyncQueueEntry, number>

  constructor() {
    super('dttmrdb')

    this.version(1).stores({
      lists: 'id, name, pendingSync',
      listItems: 'id, list_id, title, is_completed, pendingSync',
      syncQueue: '++id, type, createdAt',
    })
  }
}

export const db = new AppDatabase()
