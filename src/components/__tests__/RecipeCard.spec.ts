import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RecipeCard from '../RecipeCard.vue'
import type { LocalRecipe } from '@/database/db'

describe('RecipeCard', () => {
  const sampleRecipe: LocalRecipe = {
    id: 'recipe-123',
    name: 'Lasagna',
    created_at: '2026-08-21T00:00:00.000Z',
    modified_at: '2026-08-21T00:00:00.000Z',
  }

  const routerLinkStub = {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('renders recipe name and options button', () => {
    const wrapper = mount(RecipeCard, {
      props: {
        recipe: sampleRecipe,
      },
      global: {
        stubs: { RouterLink: routerLinkStub },
      },
    })

    expect(wrapper.text()).toContain('Lasagna')
    expect(wrapper.find('.menu-trigger-btn').exists()).toBe(true)
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })

  it('toggles dropdown submenu when options button is clicked', async () => {
    const wrapper = mount(RecipeCard, {
      props: {
        recipe: sampleRecipe,
      },
      global: {
        stubs: { RouterLink: routerLinkStub },
      },
    })

    await wrapper.find('.menu-trigger-btn').trigger('click')
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(true)
    expect(wrapper.find('.submenu-item').text()).toContain('Share recipe')

    await wrapper.find('.menu-trigger-btn').trigger('click')
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })

  it('emits share event when Share recipe is clicked in submenu', async () => {
    const wrapper = mount(RecipeCard, {
      props: {
        recipe: sampleRecipe,
      },
      global: {
        stubs: { RouterLink: routerLinkStub },
      },
    })

    await wrapper.find('.menu-trigger-btn').trigger('click')
    await wrapper.find('.submenu-item').trigger('click')

    expect(wrapper.emitted('share')).toBeTruthy()
    expect(wrapper.emitted('share')?.[0]).toEqual([sampleRecipe])
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })

  it('emits delete event when Delete recipe is clicked in submenu', async () => {
    const wrapper = mount(RecipeCard, {
      props: {
        recipe: sampleRecipe,
      },
      global: {
        stubs: { RouterLink: routerLinkStub },
      },
    })

    await wrapper.find('.menu-trigger-btn').trigger('click')
    const deleteBtn = wrapper.find('.submenu-item-danger')
    expect(deleteBtn.exists()).toBe(true)
    expect(deleteBtn.text()).toContain('Delete recipe')

    await deleteBtn.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')?.[0]).toEqual([sampleRecipe])
    expect(wrapper.find('.submenu-dropdown').exists()).toBe(false)
  })

  it('shows a pending indicator while the recipe has not synced yet', () => {
    const wrapper = mount(RecipeCard, {
      props: {
        recipe: { ...sampleRecipe, pendingSync: true },
      },
      global: {
        stubs: { RouterLink: routerLinkStub },
      },
    })

    expect(wrapper.find('.pending-tag').exists()).toBe(true)
  })
})
