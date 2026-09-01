import { API_BASE_URL, extractErrorMessage } from '@/api/http'
import type { VersionInfo } from '@/types/version'

export async function getVersionApi(): Promise<VersionInfo> {
  const response = await fetch(`${API_BASE_URL}/version`)
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to load API version'))
  }
  return response.json()
}
