import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ListItemRow from '../ListItemRow.vue'
import { useListsStore } from '@/stores/lists'
import type { LocalListItem } from '@/database/db'

describe('ListItemRow', () => {
  const sampleItem: LocalListItem = {
    id: 'item-1',
    list_id: 'list-1',
    title: 'Apples',
    is_completed: false,
    created_at: '2026-08-21T00:00:00.000Z',
    modified_at: '2026-08-21T00:00:00.000Z',
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('renders item title and options menu button', () => {
    const wrapper = mount(ListItemRow, {
      props: {
        item: sampleItem,
      },
    })

    expect(wrapper.text()).toContain('Apples')
    expect(wrapper.find('.menu-trigger-btn').exists()).toBe(true)
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })

  it('toggles dropdown when menu button is clicked', async () => {
    const wrapper = mount(ListItemRow, {
      props: {
        item: sampleItem,
      },
    })

    await wrapper.find('.menu-trigger-btn').trigger('click')
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(true)
    expect(wrapper.find('.submenu-item-danger').text()).toContain('Delete item')

    await wrapper.find('.menu-trigger-btn').trigger('click')
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })

  it('toggles completed state when the title text is clicked', async () => {
    const wrapper = mount(ListItemRow, {
      props: {
        item: sampleItem,
      },
    })

    const listsStore = useListsStore()
    const toggleSpy = vi.spyOn(listsStore, 'setListItemCompleted').mockResolvedValue()

    await wrapper.find('.title').trigger('click')

    expect(toggleSpy).toHaveBeenCalledWith('item-1', true)
  })

  it('opens the title editor via the Edit title submenu item', async () => {
    const wrapper = mount(ListItemRow, {
      props: {
        item: sampleItem,
      },
    })

    await wrapper.find('.menu-trigger-btn').trigger('click')
    const editBtn = wrapper.find('.submenu-item:not(.submenu-item-danger)')
    expect(editBtn.text()).toContain('Edit title')

    await editBtn.trigger('click')

    expect(wrapper.find('.title-input').exists()).toBe(true)
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })

  it('opens a confirmation modal when Delete item is clicked in submenu', async () => {
    const wrapper = mount(ListItemRow, {
      props: {
        item: sampleItem,
      },
    })

    const listsStore = useListsStore()
    const deleteSpy = vi.spyOn(listsStore, 'deleteListItem').mockResolvedValue()

    // 1st click: open menu
    await wrapper.find('.menu-trigger-btn').trigger('click')
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(true)

    // 2nd click: opens confirmation modal, doesn't delete yet
    await wrapper.find('.submenu-item-danger').trigger('click')

    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
    expect(deleteSpy).not.toHaveBeenCalled()

    const modal = wrapper.findComponent({ name: 'DeleteListItemModal' })
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('Delete "Apples"?')

    // Confirm deletion in modal
    await modal.find('.confirm-delete-btn').trigger('click')

    expect(deleteSpy).toHaveBeenCalledWith('item-1')
    expect(wrapper.findComponent({ name: 'DeleteListItemModal' }).exists()).toBe(false)
  })

  it('cancels item deletion when cancel is clicked in confirmation modal', async () => {
    const wrapper = mount(ListItemRow, {
      props: {
        item: sampleItem,
      },
    })

    const listsStore = useListsStore()
    const deleteSpy = vi.spyOn(listsStore, 'deleteListItem').mockResolvedValue()

    await wrapper.find('.menu-trigger-btn').trigger('click')
    await wrapper.find('.submenu-item-danger').trigger('click')

    const modal = wrapper.findComponent({ name: 'DeleteListItemModal' })
    expect(modal.exists()).toBe(true)

    await modal.find('.cancel-btn').trigger('click')

    expect(deleteSpy).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'DeleteListItemModal' }).exists()).toBe(false)
  })
})
