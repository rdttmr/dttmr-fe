import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ListDetailView from '../ListDetailView.vue'
import { useListsStore } from '@/stores/lists'
import type { LocalList } from '@/database/db'

const pushMock = vi.fn<(to: string) => void>()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: pushMock,
    }),
  }
})

describe('ListDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    pushMock.mockClear()
    const listsStore = useListsStore()
    vi.spyOn(listsStore, 'loadLists').mockImplementation(async () => {})
    vi.spyOn(listsStore, 'loadListItems').mockImplementation(async () => {})
  })

  it('renders list items without the share card', () => {
    const listsStore = useListsStore()
    const sampleList: LocalList = {
      id: 'list-1',
      name: 'Groceries',
      created_at: '2026-08-21T00:00:00.000Z',
      modified_at: '2026-08-21T00:00:00.000Z',
    }
    listsStore.lists = [sampleList]

    const wrapper = mount(ListDetailView, {
      props: {
        id: 'list-1',
      },
    })

    expect(wrapper.text()).toContain('Groceries')
    expect(wrapper.text()).not.toContain('Share this list')
    expect(wrapper.find('.share-card').exists()).toBe(false)
  })

  it('opens confirmation modal and deletes list upon confirmation, then redirects to /', async () => {
    const listsStore = useListsStore()
    const deleteSpy = vi.spyOn(listsStore, 'deleteList').mockResolvedValue()
    const sampleList: LocalList = {
      id: 'list-1',
      name: 'Groceries',
      created_at: '2026-08-21T00:00:00.000Z',
      modified_at: '2026-08-21T00:00:00.000Z',
    }
    listsStore.lists = [sampleList]

    const wrapper = mount(ListDetailView, {
      props: {
        id: 'list-1',
      },
    })

    const headerMenuBtn = wrapper.find('.list-header .menu-trigger-btn')
    expect(headerMenuBtn.exists()).toBe(true)

    // 1st click: open list options menu
    await headerMenuBtn.trigger('click')
    const deleteBtn = wrapper.find('.list-header .submenu-item-danger')
    expect(deleteBtn.exists()).toBe(true)
    expect(deleteBtn.text()).toContain('Delete list')

    // 2nd click: opens confirmation modal
    await deleteBtn.trigger('click')

    const modal = wrapper.findComponent({ name: 'DeleteListModal' })
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('Delete "Groceries"?')
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()

    // Confirm deletion in modal
    await modal.find('.confirm-delete-btn').trigger('click')

    expect(deleteSpy).toHaveBeenCalledWith('list-1')
    expect(pushMock).toHaveBeenCalledWith('/')
  })

  it('cancels list deletion when cancel is clicked in confirmation modal', async () => {
    const listsStore = useListsStore()
    const deleteSpy = vi.spyOn(listsStore, 'deleteList').mockResolvedValue()
    const sampleList: LocalList = {
      id: 'list-1',
      name: 'Groceries',
      created_at: '2026-08-21T00:00:00.000Z',
      modified_at: '2026-08-21T00:00:00.000Z',
    }
    listsStore.lists = [sampleList]

    const wrapper = mount(ListDetailView, {
      props: {
        id: 'list-1',
      },
    })

    const headerMenuBtn = wrapper.find('.list-header .menu-trigger-btn')
    await headerMenuBtn.trigger('click')
    await wrapper.find('.list-header .submenu-item-danger').trigger('click')

    const modal = wrapper.findComponent({ name: 'DeleteListModal' })
    expect(modal.exists()).toBe(true)

    await modal.find('.cancel-btn').trigger('click')

    expect(deleteSpy).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'DeleteListModal' }).exists()).toBe(false)
  })

  it('allows deleting list items via two clicks on item row menu', async () => {
    const listsStore = useListsStore()
    const deleteItemSpy = vi.spyOn(listsStore, 'deleteListItem').mockResolvedValue()
    const sampleList: LocalList = {
      id: 'list-1',
      name: 'Groceries',
      created_at: '2026-08-21T00:00:00.000Z',
      modified_at: '2026-08-21T00:00:00.000Z',
    }
    listsStore.lists = [sampleList]
    listsStore.listItems = [
      {
        id: 'item-1',
        list_id: 'list-1',
        title: 'Apples',
        is_completed: false,
        created_at: '2026-08-21T00:00:00.000Z',
        modified_at: '2026-08-21T00:00:00.000Z',
      },
    ]

    const wrapper = mount(ListDetailView, {
      props: {
        id: 'list-1',
      },
    })

    const itemRow = wrapper.findComponent({ name: 'ListItemRow' })
    expect(itemRow.exists()).toBe(true)

    // 1st click: open item menu
    await itemRow.find('.menu-trigger-btn').trigger('click')
    const deleteItemBtn = itemRow.find('.submenu-item-danger')
    expect(deleteItemBtn.exists()).toBe(true)

    // 2nd click: delete item
    await deleteItemBtn.trigger('click')

    expect(deleteItemSpy).toHaveBeenCalledWith('item-1')
  })
})
