export interface Recipe {
  id: string
  // The group the recipe belongs to. It can only link items of lists in the same group.
  group_id?: string
  name: string
  created_at?: string
  modified_at?: string
  position?: number
  // Number of items in the recipe, provided by GET /recipes so the overview
  // can show a count before the recipe's items have been fetched.
  total_items?: number
}

export interface CreateRecipePayload {
  name: string
  // Optional: the server falls back to the user's default group.
  group_id?: string
}

export interface SetRecipeNamePayload {
  name: string
}

export interface AddListItemToRecipePayload {
  recipe_id: string
  list_item_id: string
}

export interface RemoveListItemFromRecipePayload {
  recipe_id: string
  list_item_id: string
}

export interface OrderRecipesPayload {
  recipe_ids: string[]
}

export interface SetRecipeGroupPayload {
  group_id: string
}
