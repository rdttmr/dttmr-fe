import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RenameModal from '../RenameModal.vue'

describe('RenameModal', () => {
  it('prefills the current name and titles the sheet by kind', () => {
    const wrapper = mount(RenameModal, { props: { kind: 'recipe', currentName: 'Pancakes' } })

    expect(wrapper.text()).toContain('Rename recipe')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('Pancakes')
  })

  it('emits save with the trimmed new name', async () => {
    const wrapper = mount(RenameModal, { props: { kind: 'list', currentName: 'Groceries' } })

    await wrapper.find('input').setValue('  Weekly shop ')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')).toEqual([['Weekly shop']])
  })

  it('closes without saving when the name is unchanged', async () => {
    const wrapper = mount(RenameModal, { props: { kind: 'list', currentName: 'Groceries' } })

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('does not save a blank name', async () => {
    const wrapper = mount(RenameModal, { props: { kind: 'list', currentName: 'Groceries' } })

    await wrapper.find('input').setValue('   ')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})
