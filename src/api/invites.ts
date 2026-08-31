import { apiClient } from '@/api/client'
import { extractErrorMessage } from '@/api/http'
import type { Invite } from '@/types/invite'

export async function getInvitesApi(): Promise<Invite[]> {
  const response = await apiClient.get('/user/invites')
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to load invites'))
  }
  return response.json()
}

export async function createInviteApi(): Promise<Invite> {
  const response = await apiClient.post('/user/invites')
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to create invite'))
  }
  return response.json()
}

export async function deleteInviteApi(id: string): Promise<void> {
  const response = await apiClient.delete(`/user/invites/${id}`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to delete invite'))
  }
}
