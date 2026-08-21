import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DeleteListModal from '../DeleteListModal.vue'
import type { LocalList } from '@/database/db'

describe('DeleteListModal', () => {
  const sampleList: LocalList = {
    id: 'list-123',
    name: 'Groceries',
    created_at: '2026-08-21T00:00:00.000Z',
    modified_at: '2026-08-21T00:00:00.000Z',
  }

  it('renders modal with list name and confirmation prompt', () => {
    const wrapper = mount(DeleteListModal, {
      props: {
        list: sampleList,
      },
    })

    expect(wrapper.text()).toContain('Delete "Groceries"?')
    expect(wrapper.text()).toContain('Are you sure you want to delete this list?')
    expect(wrapper.find('.confirm-delete-btn').text()).toBe('Delete list')
    expect(wrapper.find('.cancel-btn').text()).toBe('Cancel')
  })

  it('emits confirm event when Delete button is clicked', async () => {
    const wrapper = mount(DeleteListModal, {
      props: {
        list: sampleList,
      },
    })

    await wrapper.find('.confirm-delete-btn').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('emits close event when Cancel button is clicked', async () => {
    const wrapper = mount(DeleteListModal, {
      props: {
        list: sampleList,
      },
    })

    await wrapper.find('.cancel-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close event when close icon button is clicked', async () => {
    const wrapper = mount(DeleteListModal, {
      props: {
        list: sampleList,
      },
    })

    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close event when clicking overlay background', async () => {
    const wrapper = mount(DeleteListModal, {
      props: {
        list: sampleList,
      },
    })

    await wrapper.find('.modal-overlay').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
