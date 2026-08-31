import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '../index'
import { useAuthStore } from '@/stores/auth'

describe('router', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('redirects unauthenticated access to protected routes to login', async () => {
    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('allows authenticated access to protected routes', async () => {
    const authStore = useAuthStore()
    authStore.setTokens({ access_token: 'token', refresh_token: 'refresh' })

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('lists')
  })

  it('redirects any route carrying ?invite= to the (unlisted) register route', async () => {
    await router.push('/?invite=abc123')

    expect(router.currentRoute.value.name).toBe('register')
    expect(router.currentRoute.value.query.invite).toBe('abc123')
  })

  it('redirects an authenticated route with an invite code to register too', async () => {
    const authStore = useAuthStore()
    authStore.setTokens({ access_token: 'token', refresh_token: 'refresh' })

    await router.push('/account?invite=abc123')

    expect(router.currentRoute.value.name).toBe('register')
    expect(router.currentRoute.value.query.invite).toBe('abc123')
  })

  it('does not redirect when already navigating to register with an invite code', async () => {
    await router.push('/register?invite=xyz')

    expect(router.currentRoute.value.name).toBe('register')
  })

  it('does not redirect to register when there is no invite code', async () => {
    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('login')
  })
})
