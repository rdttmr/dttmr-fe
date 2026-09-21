export interface Recipe {
  id: string
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

export interface RecipeShareCode {
  code: string
}
