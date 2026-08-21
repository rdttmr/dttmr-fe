import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ListCard from '../ListCard.vue'
import type { LocalList } from '@/database/db'

describe('ListCard', () => {
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

  it('renders list name and options button', () => {
    const wrapper = mount(ListCard, {
      props: {
        list: sampleList,
      },
      global: {
        stubs: {
          RouterLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Groceries')
    expect(wrapper.find('.menu-trigger-btn').exists()).toBe(true)
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })

  it('toggles dropdown submenu when options button is clicked', async () => {
    const wrapper = mount(ListCard, {
      props: {
        list: sampleList,
      },
      global: {
        stubs: {
          RouterLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })

    await wrapper.find('.menu-trigger-btn').trigger('click')
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(true)
    expect(wrapper.find('.submenu-item').text()).toContain('Share list')

    await wrapper.find('.menu-trigger-btn').trigger('click')
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })

  it('emits share event when Share list is clicked in submenu', async () => {
    const wrapper = mount(ListCard, {
      props: {
        list: sampleList,
      },
      global: {
        stubs: {
          RouterLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })

    await wrapper.find('.menu-trigger-btn').trigger('click')
    await wrapper.find('.submenu-item').trigger('click')

    expect(wrapper.emitted('share')).toBeTruthy()
    expect(wrapper.emitted('share')?.[0]).toEqual([sampleList])
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })

  it('emits delete event when Delete list is clicked in submenu', async () => {
    const wrapper = mount(ListCard, {
      props: {
        list: sampleList,
      },
      global: {
        stubs: {
          RouterLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })

    await wrapper.find('.menu-trigger-btn').trigger('click')
    const deleteBtn = wrapper.find('.submenu-item-danger')
    expect(deleteBtn.exists()).toBe(true)
    expect(deleteBtn.text()).toContain('Delete list')

    await deleteBtn.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')?.[0]).toEqual([sampleList])
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })
})
