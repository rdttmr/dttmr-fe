import { apiClient } from '@/api/client'
import { extractErrorMessage } from '@/api/http'
import type { ChangePasswordPayload } from '@/types/auth'
import type { CreateUserPayload, User } from '@/types/user'

export async function changePasswordApi(payload: ChangePasswordPayload): Promise<void> {
  const response = await apiClient.post('/user/password', payload)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to change password'))
  }
}

export async function createUserApi(payload: CreateUserPayload): Promise<User> {
  const response = await apiClient.post('/users', payload)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to create account'))
  }
  return response.json()
}
