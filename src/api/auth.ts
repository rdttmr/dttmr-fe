import type { LoginPayload, RefreshPayload, TokenPair } from '@/types/auth'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const errorData = await response.json()
    return errorData.message || errorData.error || fallback
  } catch {
    return response.statusText || fallback
  }
}

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
