import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DeleteRecipeModal from '../DeleteRecipeModal.vue'
import type { LocalRecipe } from '@/database/db'

describe('DeleteRecipeModal', () => {
  const sampleRecipe: LocalRecipe = {
    id: 'recipe-1',
    name: 'Lasagna',
    created_at: '2026-08-21T00:00:00.000Z',
    modified_at: '2026-08-21T00:00:00.000Z',
  }

  it('renders modal with recipe name and confirmation prompt', () => {
    const wrapper = mount(DeleteRecipeModal, {
      props: {
        recipe: sampleRecipe,
      },
    })

    expect(wrapper.text()).toContain('Delete "Lasagna"?')
    expect(wrapper.text()).toContain('Are you sure you want to delete this recipe?')
    expect(wrapper.find('.confirm-delete-btn').text()).toBe('Delete recipe')
    expect(wrapper.find('.cancel-btn').text()).toBe('Cancel')
  })

  it('emits confirm event when Delete button is clicked', async () => {
    const wrapper = mount(DeleteRecipeModal, {
      props: {
        recipe: sampleRecipe,
      },
    })

    await wrapper.find('.confirm-delete-btn').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('emits close event when Cancel button is clicked', async () => {
    const wrapper = mount(DeleteRecipeModal, {
      props: {
        recipe: sampleRecipe,
      },
    })

    await wrapper.find('.cancel-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
