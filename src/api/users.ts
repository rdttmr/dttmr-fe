import { apiClient } from '@/api/client'
import { extractErrorMessage } from '@/api/http'
import type { ChangePasswordPayload } from '@/types/auth'

export async function changePasswordApi(payload: ChangePasswordPayload): Promise<void> {
  const response = await apiClient.post('/users/password', payload)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to change password'))
  }
}
