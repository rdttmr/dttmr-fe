import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL } from '@/api/auth'

let refreshPromise: Promise<unknown> | null = null

export interface FetchOptions extends RequestInit {
  skipAuth?: boolean
  skipRefresh?: boolean
}

function buildHeaders(options: RequestInit, accessToken: string | null): Headers {
  const headers = new Headers(options.headers || {})

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

function buildUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint
  }
  return `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
}

export async function fetchWithAuth(
  endpoint: string,
  options: FetchOptions = {},
): Promise<Response> {
  const authStore = useAuthStore()
  const { skipAuth = false, skipRefresh = false, ...customOptions } = options

  const url = buildUrl(endpoint)

  let response = await fetch(url, {
    ...customOptions,
    headers: buildHeaders(customOptions, skipAuth ? null : authStore.accessToken),
  })

  if (response.status === 401 && !skipRefresh && authStore.refreshToken) {
    try {
      if (!refreshPromise) {
        refreshPromise = authStore.refreshTokens().finally(() => {
          refreshPromise = null
        })
      }
      await refreshPromise

      response = await fetch(url, {
        ...customOptions,
        headers: buildHeaders(customOptions, authStore.accessToken),
      })
    } catch {
      return response
    }
  }

  return response
}

export const apiClient = {
  get: (endpoint: string, options?: FetchOptions) =>
    fetchWithAuth(endpoint, { ...options, method: 'GET' }),
  post: (endpoint: string, body?: unknown, options?: FetchOptions) =>
    fetchWithAuth(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: (endpoint: string, body?: unknown, options?: FetchOptions) =>
    fetchWithAuth(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: (endpoint: string, options?: FetchOptions) =>
    fetchWithAuth(endpoint, { ...options, method: 'DELETE' }),
}
