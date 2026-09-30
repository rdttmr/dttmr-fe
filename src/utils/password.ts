export const MIN_PASSWORD_LENGTH = 8
// bcrypt's limit. It counts UTF-8 bytes, not characters, so a password of
// multi-byte characters hits it sooner. The server rejects longer passwords.
export const MAX_PASSWORD_BYTES = 72

// Why a new password isn't acceptable, or null if it is.
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return 'Password is too long. Use a shorter one or fewer special characters.'
  }
  return null
}
