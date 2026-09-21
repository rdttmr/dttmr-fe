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

  it('shows the server-provided item count without any local items', () => {
    const wrapper = mount(RecipeCard, {
      props: { recipe: { ...sampleRecipe, total_items: 4 } },
      global: { stubs: { RouterLink: routerLinkStub } },
    })

    expect(wrapper.find('.meta').text()).toContain('4 ingredients')
  })

  it('uses the singular form for a single item and "No items yet" for zero', () => {
    const one = mount(RecipeCard, {
      props: { recipe: { ...sampleRecipe, total_items: 1 } },
      global: { stubs: { RouterLink: routerLinkStub } },
    })
    const none = mount(RecipeCard, {
      props: { recipe: { ...sampleRecipe, total_items: 0 } },
      global: { stubs: { RouterLink: routerLinkStub } },
    })

    expect(one.find('.meta').text()).toContain('1 ingredient')
    expect(one.find('.meta').text()).not.toContain('ingredients')
    expect(none.find('.meta').text()).toContain('No items yet')
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

  it('hides the drag handle unless the card is sortable', () => {
    const wrapper = mount(RecipeCard, {
      props: { recipe: sampleRecipe },
      global: { stubs: { RouterLink: routerLinkStub } },
    })

    expect(wrapper.find('.grab-handle').exists()).toBe(false)
  })

  it('emits handle-pointerdown when the drag handle is pressed', async () => {
    const wrapper = mount(RecipeCard, {
      props: { recipe: sampleRecipe, sortable: true },
      global: { stubs: { RouterLink: routerLinkStub } },
    })

    await wrapper.find('.grab-handle').trigger('pointerdown')

    expect(wrapper.emitted('handle-pointerdown')).toHaveLength(1)
  })

  it('marks the card as dragging while a drag is in progress', () => {
    const wrapper = mount(RecipeCard, {
      props: { recipe: sampleRecipe, sortable: true, dragging: true },
      global: { stubs: { RouterLink: routerLinkStub } },
    })

    expect(wrapper.find('.recipe-card').classes()).toContain('is-dragging')
  })
})
