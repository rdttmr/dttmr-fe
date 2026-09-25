import { apiClient } from '@/api/client'
import { ApiError, extractErrorMessage } from '@/api/http'
import type {
  Recipe,
  CreateRecipePayload,
  SetRecipeNamePayload,
  AddListItemToRecipePayload,
  RemoveListItemFromRecipePayload,
  OrderRecipesPayload,
  SetRecipeGroupPayload,
} from '@/types/recipe'
import type { ListItem } from '@/types/list'

export async function getRecipesApi(): Promise<Recipe[]> {
  const response = await apiClient.get('/recipes')
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to load recipes'))
  }
  return response.json()
}

export async function createRecipeApi(payload: CreateRecipePayload): Promise<Recipe> {
  const response = await apiClient.post('/recipes', payload)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to create recipe'))
  }
  return response.json()
}

export async function renameRecipeApi(
  recipeId: string,
  payload: SetRecipeNamePayload,
): Promise<void> {
  const response = await apiClient.post(`/recipes/${recipeId}/name`, payload)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to rename recipe'))
  }
}

export async function getRecipeItemsApi(recipeId: string): Promise<ListItem[]> {
  const response = await apiClient.get(`/recipes/${recipeId}`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to load recipe items'))
  }
  return response.json()
}

export async function orderRecipesApi(payload: OrderRecipesPayload): Promise<void> {
  const response = await apiClient.post('/recipes/order', payload)
  if (!response.ok) {
    throw new ApiError(
      await extractErrorMessage(response, 'Failed to reorder recipes'),
      response.status,
    )
  }
}

export async function deleteRecipeApi(recipeId: string): Promise<void> {
  const response = await apiClient.delete(`/recipes/${recipeId}`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to delete recipe'))
  }
}

export async function addListItemToRecipeApi(payload: AddListItemToRecipePayload): Promise<void> {
  const response = await apiClient.post('/recipes/items', payload)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to add item to recipe'))
  }
}

export async function removeListItemFromRecipeApi(
  payload: RemoveListItemFromRecipePayload,
): Promise<void> {
  const response = await apiClient.delete('/recipes/items', payload)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to remove item from recipe'))
  }
}

export async function uncheckRecipeApi(recipeId: string): Promise<void> {
  const response = await apiClient.post(`/recipes/${recipeId}/uncheck`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to uncheck recipe items'))
  }
}

export async function setRecipeGroupApi(
  recipeId: string,
  payload: SetRecipeGroupPayload,
): Promise<void> {
  const response = await apiClient.post(`/recipes/${recipeId}/group`, payload)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to move recipe'))
  }
}
