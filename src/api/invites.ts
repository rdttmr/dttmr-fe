import { apiClient } from '@/api/client'
import { extractErrorMessage } from '@/api/http'
import type { Invite, InviteStatusCounts, PaginatedInvites } from '@/types/invite'

export interface GetInvitesParams {
  page?: number
  count?: number
}

export async function getInvitesApi(params: GetInvitesParams = {}): Promise<PaginatedInvites> {
  const query = new URLSearchParams()
  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.count !== undefined) query.set('count', String(params.count))
  const queryString = query.toString()

  const response = await apiClient.get(`/user/invites${queryString ? `?${queryString}` : ''}`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to load invites'))
  }
  return response.json()
}

export async function getInviteStatusApi(): Promise<InviteStatusCounts> {
  const response = await apiClient.get('/user/invites/status')
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to load invite counts'))
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
