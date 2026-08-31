import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RegisterView from '../RegisterView.vue'
import { useAuthStore } from '@/stores/auth'
import { useListsStore } from '@/stores/lists'
import * as usersApi from '@/api/users'

const mockPush = vi.fn<(to: string) => void>()
let routeQuery: Record<string, string> = { invite: 'invite-code-123' }

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush,
    }),
    useRoute: () => ({
      query: routeQuery,
    }),
  }
})

describe('RegisterView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
    mockPush.mockClear()
    routeQuery = { invite: 'invite-code-123' }
  })

  it('shows an invalid-invite message when there is no invite code in the URL', () => {
    routeQuery = {}

    const wrapper = mount(RegisterView)

    expect(wrapper.find('.invalid-invite').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('renders the registration form when an invite code is present', () => {
    const wrapper = mount(RegisterView)

    expect(wrapper.find('h2').text()).toBe('Create your account')
    expect(wrapper.find('input#name').exists()).toBe(true)
    expect(wrapper.find('input#email').exists()).toBe(true)
    expect(wrapper.find('input#password').exists()).toBe(true)
    expect(wrapper.find('input#confirm-password').exists()).toBe(true)
  })

  it('shows logged in status and hides the form if already authenticated', () => {
    const authStore = useAuthStore()
    authStore.setTokens({ access_token: 'active-token', refresh_token: 'active-refresh' })

    const wrapper = mount(RegisterView)

    expect(wrapper.find('.already-logged-in').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('rejects passwords that are too short', async () => {
    const createSpy = vi.spyOn(usersApi, 'createUserApi')
    const wrapper = mount(RegisterView)

    await wrapper.find('#name').setValue('Jane Doe')
    await wrapper.find('#email').setValue('jane@example.com')
    await wrapper.find('#password').setValue('short')
    await wrapper.find('#confirm-password').setValue('short')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('.error-banner').text()).toContain('at least 8 characters')
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords', async () => {
    const createSpy = vi.spyOn(usersApi, 'createUserApi')
    const wrapper = mount(RegisterView)

    await wrapper.find('#name').setValue('Jane Doe')
    await wrapper.find('#email').setValue('jane@example.com')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('#confirm-password').setValue('password456')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('.error-banner').text()).toContain('do not match')
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('creates the account, logs in, syncs, and redirects home on success', async () => {
    const createSpy = vi.spyOn(usersApi, 'createUserApi').mockResolvedValueOnce({
      id: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    })
    const authStore = useAuthStore()
    const loginSpy = vi.spyOn(authStore, 'login').mockResolvedValueOnce({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
    })
    const listsStore = useListsStore()
    const syncSpy = vi.spyOn(listsStore, 'sync').mockResolvedValueOnce()

    const wrapper = mount(RegisterView)

    await wrapper.find('#name').setValue('Jane Doe')
    await wrapper.find('#email').setValue('jane@example.com')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('#confirm-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(createSpy).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
      invite_code: 'invite-code-123',
    })
    expect(loginSpy).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'password123',
    })
    expect(syncSpy).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('shows an error banner when account creation fails', async () => {
    vi.spyOn(usersApi, 'createUserApi').mockRejectedValueOnce(new Error('Invalid invite code'))

    const wrapper = mount(RegisterView)

    await wrapper.find('#name').setValue('Jane Doe')
    await wrapper.find('#email').setValue('jane@example.com')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('#confirm-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.error-banner').text()).toContain('Invalid invite code')
  })
})

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve))
}
