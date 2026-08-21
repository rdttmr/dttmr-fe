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

  it('deletes item when Delete item is clicked in submenu', async () => {
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

    // 2nd click: delete item
    await wrapper.find('.submenu-item-danger').trigger('click')

    expect(deleteSpy).toHaveBeenCalledWith('item-1')
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')?.[0]).toEqual([sampleItem])
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })
})
