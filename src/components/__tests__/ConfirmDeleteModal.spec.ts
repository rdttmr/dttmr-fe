import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDeleteModal from '../ConfirmDeleteModal.vue'

describe('ConfirmDeleteModal', () => {
  it('renders title, description, and default confirm label', () => {
    const wrapper = mount(ConfirmDeleteModal, {
      props: {
        title: 'Delete "Groceries"?',
        description: 'Are you sure?',
      },
    })

    expect(wrapper.text()).toContain('Delete "Groceries"?')
    expect(wrapper.text()).toContain('Are you sure?')
    expect(wrapper.find('.confirm-delete-btn').text()).toBe('Delete')
    expect(wrapper.find('.cancel-btn').text()).toBe('Cancel')
  })

  it('renders a custom confirm label', () => {
    const wrapper = mount(ConfirmDeleteModal, {
      props: {
        title: 'Delete "Apples"?',
        description: 'Are you sure?',
        confirmLabel: 'Delete item',
      },
    })

    expect(wrapper.find('.confirm-delete-btn').text()).toBe('Delete item')
  })

  it('emits confirm event when Delete button is clicked', async () => {
    const wrapper = mount(ConfirmDeleteModal, {
      props: {
        title: 'Delete "Groceries"?',
        description: 'Are you sure?',
      },
    })

    await wrapper.find('.confirm-delete-btn').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('emits close event when Cancel button is clicked', async () => {
    const wrapper = mount(ConfirmDeleteModal, {
      props: {
        title: 'Delete "Groceries"?',
        description: 'Are you sure?',
      },
    })

    await wrapper.find('.cancel-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close event when close icon button is clicked', async () => {
    const wrapper = mount(ConfirmDeleteModal, {
      props: {
        title: 'Delete "Groceries"?',
        description: 'Are you sure?',
      },
    })

    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close event when clicking overlay background', async () => {
    const wrapper = mount(ConfirmDeleteModal, {
      props: {
        title: 'Delete "Groceries"?',
        description: 'Are you sure?',
      },
    })

    await wrapper.find('.modal-overlay').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
