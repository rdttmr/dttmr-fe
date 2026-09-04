import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DeleteListItemModal from '../DeleteListItemModal.vue'
import type { LocalListItem } from '@/database/db'

describe('DeleteListItemModal', () => {
  const sampleItem: LocalListItem = {
    id: 'item-1',
    list_id: 'list-1',
    title: 'Apples',
    is_completed: false,
    created_at: '2026-08-21T00:00:00.000Z',
    modified_at: '2026-08-21T00:00:00.000Z',
  }

  it('renders modal with item title and confirmation prompt', () => {
    const wrapper = mount(DeleteListItemModal, {
      props: {
        item: sampleItem,
      },
    })

    expect(wrapper.text()).toContain('Delete "Apples"?')
    expect(wrapper.text()).toContain('Are you sure you want to delete this item?')
    expect(wrapper.find('.confirm-delete-btn').text()).toBe('Delete item')
    expect(wrapper.find('.cancel-btn').text()).toBe('Cancel')
  })

  it('emits confirm event when Delete button is clicked', async () => {
    const wrapper = mount(DeleteListItemModal, {
      props: {
        item: sampleItem,
      },
    })

    await wrapper.find('.confirm-delete-btn').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('emits close event when Cancel button is clicked', async () => {
    const wrapper = mount(DeleteListItemModal, {
      props: {
        item: sampleItem,
      },
    })

    await wrapper.find('.cancel-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
