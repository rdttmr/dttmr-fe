export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const errorData = await response.json()
    return errorData.message || errorData.error || fallback
  } catch {
    return response.statusText || fallback
  }
}

// An HTTP error response, carrying the status so callers can tell a request
// the server actively refused (4xx) from one that never got a usable answer
// (network failure, 5xx).
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// True when the server understood the request and refused it, so sending the
// exact same request again can never succeed. 401 (session refresh), 408 and
// 429 are excluded: those are about timing/credentials, not the payload.
export function isServerRejection(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status >= 400 &&
    err.status < 500 &&
    ![401, 408, 429].includes(err.status)
  )
}
