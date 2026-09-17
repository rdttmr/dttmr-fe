export interface Recipe {
  id: string
  name: string
  created_at?: string
  modified_at?: string
  position?: number
}

export interface CreateRecipePayload {
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

export interface RecipeShareCode {
  code: string
}
