import Dexie from 'dexie';

export const db = new Dexie('dttmrdb')

db.version(1).stores({
  lists: '++id, uuid, title',

  listItems: '++id, uuid, title, isChecked',

  syncQueue: '++id, action, endpoint, createdAt',
})

