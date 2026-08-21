import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ShareListModal from '../ShareListModal.vue'
import { useListsStore } from '@/stores/lists'
import type { LocalList } from '@/database/db'

describe('ShareListModal', () => {
  const sampleList: LocalList = {
    id: 'list-123',
    name: 'Groceries',
    created_at: '2026-08-21T00:00:00.000Z',
    modified_at: '2026-08-21T00:00:00.000Z',
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('renders modal with list name and user input', () => {
    const wrapper = mount(ShareListModal, {
      props: {
        list: sampleList,
      },
    })

    expect(wrapper.text()).toContain('Share "Groceries"')
    expect(wrapper.find('input[placeholder="Email"]').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Add')
  })

  it('submits form to share list with an email', async () => {
    const listsStore = useListsStore()
    const addSpy = vi.spyOn(listsStore, 'addUserToList').mockResolvedValueOnce()

    const wrapper = mount(ShareListModal, {
      props: {
        list: sampleList,
      },
    })

    await wrapper.find('input').setValue('user@example.com')
    await wrapper.find('form').trigger('submit.prevent')

    expect(addSpy).toHaveBeenCalledWith('list-123', 'user@example.com')
    expect(wrapper.find('.banner-success').text()).toContain('Shared with "user@example.com"!')
  })

  it('displays error banner when sharing fails', async () => {
    const listsStore = useListsStore()
    vi.spyOn(listsStore, 'addUserToList').mockRejectedValueOnce(new Error('User not found'))

    const wrapper = mount(ShareListModal, {
      props: {
        list: sampleList,
      },
    })

    await wrapper.find('input').setValue('bad@example.com')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('.banner-error').text()).toContain('User not found')
  })

  it('emits close event when close button is clicked', async () => {
    const wrapper = mount(ShareListModal, {
      props: {
        list: sampleList,
      },
    })

    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close event when Done button is clicked', async () => {
    const wrapper = mount(ShareListModal, {
      props: {
        list: sampleList,
      },
    })

    await wrapper.find('.modal-footer .btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
