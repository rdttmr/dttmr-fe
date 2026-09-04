import { apiClient } from '@/api/client'
import { extractErrorMessage } from '@/api/http'
import type { PaginatedExercises } from '@/types/exercise'

export interface GetExercisesParams {
  page?: number
  count?: number
}

export async function getExercisesApi(
  params: GetExercisesParams = {},
): Promise<PaginatedExercises> {
  const query = new URLSearchParams()
  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.count !== undefined) query.set('count', String(params.count))
  const queryString = query.toString()

  const response = await apiClient.get(`/exercises${queryString ? `?${queryString}` : ''}`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to load exercises'))
  }
  return response.json()
}
