import { apiClient } from '@/api/client'
import { extractErrorMessage } from '@/api/http'
import type {
  Group,
  GroupInvite,
  GroupMember,
  CreateGroupPayload,
  SetGroupNamePayload,
} from '@/types/group'

export async function getGroupsApi(): Promise<Group[]> {
  const response = await apiClient.get('/groups')
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to load groups'))
  }
  return response.json()
}

export async function createGroupApi(payload: CreateGroupPayload): Promise<Group> {
  const response = await apiClient.post('/groups', payload)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to create group'))
  }
  return response.json()
}

export async function renameGroupApi(groupId: string, payload: SetGroupNamePayload): Promise<void> {
  const response = await apiClient.post(`/groups/${groupId}/name`, payload)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to rename group'))
  }
}

export async function setDefaultGroupApi(groupId: string): Promise<void> {
  const response = await apiClient.post(`/groups/${groupId}/default`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to set default group'))
  }
}

export async function getGroupMembersApi(groupId: string): Promise<GroupMember[]> {
  const response = await apiClient.get(`/groups/${groupId}/members`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to load group members'))
  }
  return response.json()
}

export async function shareGroupApi(groupId: string): Promise<GroupInvite> {
  const response = await apiClient.post(`/groups/${groupId}/share`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to share group'))
  }
  return response.json()
}

// swagger.json documents /groups/join/{code}, but the backend serves
// POST /groups/join with the code in the body only.
export async function joinGroupApi(code: string): Promise<void> {
  const response = await apiClient.post('/groups/join', { code })
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to join group'))
  }
}

export async function deleteGroupApi(groupId: string): Promise<void> {
  const response = await apiClient.delete(`/groups/${groupId}`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to delete group'))
  }
}
