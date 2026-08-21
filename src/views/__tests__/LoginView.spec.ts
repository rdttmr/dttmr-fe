import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '../LoginView.vue'
import { useAuthStore } from '@/stores/auth'

const mockPush = vi.fn<(to: string) => void>()
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush,
    }),
    useRoute: () => ({
      query: {},
    }),
  }
})

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
    mockPush.mockClear()
  })

  it('renders login form with email and password inputs', () => {
    const wrapper = mount(LoginView)

    expect(wrapper.find('h2').text()).toBe('Login')
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Log In')
  })

  it('submits login form and navigates to default route on success', async () => {
    const authStore = useAuthStore()
    const loginSpy = vi.spyOn(authStore, 'login').mockResolvedValueOnce({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
    })

    const wrapper = mount(LoginView)

    await wrapper.find('input[type="email"]').setValue('user@example.com')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')

    expect(loginSpy).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret123',
    })
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('displays error banner when login fails', async () => {
    const authStore = useAuthStore()
    vi.spyOn(authStore, 'login').mockRejectedValueOnce(new Error('Invalid email or password'))

    const wrapper = mount(LoginView)

    await wrapper.find('input[type="email"]').setValue('user@example.com')
    await wrapper.find('input[type="password"]').setValue('wrong-password')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('.error-banner').exists()).toBe(true)
    expect(wrapper.find('.error-banner').text()).toContain('Invalid email or password')
  })

  it('shows logged in status and logout button if already authenticated', () => {
    const authStore = useAuthStore()
    authStore.setTokens({
      access_token: 'active-token',
      refresh_token: 'active-refresh',
    })

    const wrapper = mount(LoginView)

    expect(wrapper.find('.already-logged-in').exists()).toBe(true)
    expect(wrapper.text()).toContain('You are already logged in.')
  })
})
