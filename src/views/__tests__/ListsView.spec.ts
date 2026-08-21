import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ListsView from '../ListsView.vue'
import { useListsStore } from '@/stores/lists'
import type { LocalList } from '@/database/db'

describe('ListsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    const listsStore = useListsStore()
    vi.spyOn(listsStore, 'loadLists').mockImplementation(async () => {})
  })

  it('renders lists and opens share modal when list card emits share', async () => {
    const listsStore = useListsStore()
    const sampleList: LocalList = {
      id: 'list-1',
      name: 'Shopping',
      created_at: '2026-08-21T00:00:00.000Z',
      modified_at: '2026-08-21T00:00:00.000Z',
    }
    listsStore.lists = [sampleList]

    const wrapper = mount(ListsView, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Shopping')
    expect(wrapper.findComponent({ name: 'ShareListModal' }).exists()).toBe(false)

    // Trigger share from ListCard
    await wrapper.find('.menu-trigger-btn').trigger('click')
    await wrapper.find('.submenu-item').trigger('click')

    expect(wrapper.findComponent({ name: 'ShareListModal' }).exists()).toBe(true)
    expect(wrapper.find('#share-modal-title').text()).toBe('Share "Shopping"')
  })

  it('opens confirmation modal and deletes list upon confirmation', async () => {
    const listsStore = useListsStore()
    const deleteSpy = vi.spyOn(listsStore, 'deleteList').mockResolvedValue()
    const sampleList: LocalList = {
      id: 'list-1',
      name: 'Shopping',
      created_at: '2026-08-21T00:00:00.000Z',
      modified_at: '2026-08-21T00:00:00.000Z',
    }
    listsStore.lists = [sampleList]

    const wrapper = mount(ListsView, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })

    expect(wrapper.findComponent({ name: 'DeleteListModal' }).exists()).toBe(false)

    // Click 1: open menu
    await wrapper.find('.menu-trigger-btn').trigger('click')
    // Click 2: click delete list option in menu
    await wrapper.find('.submenu-item-danger').trigger('click')

    // Modal should now be open
    const modal = wrapper.findComponent({ name: 'DeleteListModal' })
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('Delete "Shopping"?')
    expect(deleteSpy).not.toHaveBeenCalled()

    // Confirm deletion in modal
    await modal.find('.confirm-delete-btn').trigger('click')

    expect(deleteSpy).toHaveBeenCalledWith('list-1')
    expect(wrapper.findComponent({ name: 'DeleteListModal' }).exists()).toBe(false)
  })

  it('cancels list deletion when cancel is clicked in confirmation modal', async () => {
    const listsStore = useListsStore()
    const deleteSpy = vi.spyOn(listsStore, 'deleteList').mockResolvedValue()
    const sampleList: LocalList = {
      id: 'list-1',
      name: 'Shopping',
      created_at: '2026-08-21T00:00:00.000Z',
      modified_at: '2026-08-21T00:00:00.000Z',
    }
    listsStore.lists = [sampleList]

    const wrapper = mount(ListsView, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })

    // Click 1: open menu
    await wrapper.find('.menu-trigger-btn').trigger('click')
    // Click 2: click delete list option in menu
    await wrapper.find('.submenu-item-danger').trigger('click')

    const modal = wrapper.findComponent({ name: 'DeleteListModal' })
    expect(modal.exists()).toBe(true)

    // Cancel in modal
    await modal.find('.cancel-btn').trigger('click')

    expect(deleteSpy).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'DeleteListModal' }).exists()).toBe(false)
  })
})
