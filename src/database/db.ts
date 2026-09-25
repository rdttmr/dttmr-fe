import Dexie, { type Table } from 'dexie'
import type {
  List,
  ListItem,
  CreateListPayload,
  CreateListItemPayload,
  SetListItemCompletedPayload,
  SetListItemTitlePayload,
  SetListNamePayload,
  OrderListsPayload,
} from '@/types/list'
import type {
  Recipe,
  CreateRecipePayload,
  SetRecipeNamePayload,
  AddListItemToRecipePayload,
  RemoveListItemFromRecipePayload,
  OrderRecipesPayload,
} from '@/types/recipe'
import type { Group } from '@/types/group'

export interface LocalList extends List {
  pendingSync?: boolean
  // Stable identity for this list on this client, independent of `id`.
  // `id` starts out as a client-generated placeholder and gets swapped for
  // the server-assigned one once "createList" syncs (see remapListId) -
  // clientId never changes, so UI code that needs a stable key across that
  // swap (e.g. <TransitionGroup>'s :key) can use it instead of `id`.
  clientId?: string
}

export interface LocalListItem extends ListItem {
  pendingSync?: boolean
}

export interface LocalRecipe extends Recipe {
  pendingSync?: boolean
  // Same purpose as LocalList.clientId (see above) - stable across the
  // client-generated id being remapped once "createRecipe" syncs.
  clientId?: string
}

// A recipe's items aren't stored as their own records - a recipe is just a
// named collection of existing list items, so membership is this link table
// (recipe_id/list_item_id pair) and the item's actual data (title,
// is_completed, ...) is looked up from db.listItems, same table the lists
// feature already owns.
export interface RecipeItemLink {
  recipeId: string
  listItemId: string
  pendingSync?: boolean
}

export interface DeleteListPayload {
  id: string
}

export interface DeleteListItemPayload {
  id: string
}

export interface DeleteRecipePayload {
  id: string
}

export interface UncheckRecipePayload {
  id: string
}

interface SyncQueueEntryBase {
  id?: number
  localListId?: string
  localListItemId?: string
  localRecipeId?: string
  createdAt: number
  attempts: number
  lastError?: string
}

type SyncOperationPayloads = {
  createList: CreateListPayload
  renameList: SetListNamePayload
  createListItem: CreateListItemPayload
  updateListItemTitle: SetListItemTitlePayload
  setListItemCompleted: SetListItemCompletedPayload
  deleteList: DeleteListPayload
  deleteListItem: DeleteListItemPayload
  orderLists: OrderListsPayload
  createRecipe: CreateRecipePayload
  renameRecipe: SetRecipeNamePayload
  addRecipeItem: AddListItemToRecipePayload
  removeRecipeItem: RemoveListItemFromRecipePayload
  deleteRecipe: DeleteRecipePayload
  uncheckRecipe: UncheckRecipePayload
  orderRecipes: OrderRecipesPayload
}

export type SyncOperationType = keyof SyncOperationPayloads

// A discriminated union keyed on `type` instead of a single `payload: unknown`
// shape, so `processSyncEntry`'s switch narrows `entry.payload` to the right
// type per case without a manual cast - and adding/changing an operation type
// here is a compile error everywhere it's handled inconsistently.
export type SyncQueueEntry = {
  [K in SyncOperationType]: SyncQueueEntryBase & { type: K; payload: SyncOperationPayloads[K] }
}[SyncOperationType]

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

export type NewSyncQueueEntry = DistributiveOmit<SyncQueueEntry, 'id' | 'createdAt' | 'attempts'>

class AppDatabase extends Dexie {
  lists!: Table<LocalList, string>
  listItems!: Table<LocalListItem, string>
  syncQueue!: Table<SyncQueueEntry, number>
  recipes!: Table<LocalRecipe, string>
  recipeItems!: Table<RecipeItemLink, [string, string]>
  // A read cache of GET /groups, so the group filter and pickers work offline.
  // Group mutations are online-only, so there is no pendingSync here.
  groups!: Table<Group, string>

  constructor() {
    super('dttmrdb')

    this.version(1).stores({
      lists: 'id, name, pendingSync',
      listItems: 'id, list_id, title, is_completed, pendingSync',
      syncQueue: '++id, type, createdAt',
    })

    this.version(2).stores({
      recipes: 'id, name, pendingSync',
      recipeItems: '[recipeId+listItemId], recipeId, listItemId, pendingSync',
    })

    this.version(3).stores({
      groups: 'id',
    })
  }
}

export const db = new AppDatabase()
