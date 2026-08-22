import type { LoginPayload, RefreshPayload, TokenPair } from '@/types/auth'
import { API_BASE_URL, extractErrorMessage } from '@/api/http'

export { API_BASE_URL }

async function postJson(
  path: string,
  body: unknown,
  errorFallback: string,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, errorFallback))
  }

  return response
}

export async function loginApi(payload: LoginPayload): Promise<TokenPair> {
  const response = await postJson('/login', payload, 'Login failed')
  return response.json()
}

export async function refreshApi(payload: RefreshPayload): Promise<TokenPair> {
  const response = await postJson('/login/refresh', payload, 'Token refresh failed')
  return response.json()
}

export async function logoutApi(payload?: RefreshPayload): Promise<void> {
  await postJson('/logout', payload ?? {}, 'Logout failed')
}

export async function logoutAllApi(token?: string): Promise<void> {
  await postJson('/logout/all', {}, 'Logout all failed', token)
}
