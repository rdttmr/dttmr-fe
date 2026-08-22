export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const errorData = await response.json()
    return errorData.message || errorData.error || fallback
  } catch {
    return response.statusText || fallback
  }
}
