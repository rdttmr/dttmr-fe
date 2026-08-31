import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import InvitesPanel from '../InvitesPanel.vue'
import * as invitesApi from '@/api/invites'
import type { Invite } from '@/types/invite'

describe('InvitesPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('renders collapsed by default without loading invites', () => {
    const getSpy = vi.spyOn(invitesApi, 'getInvitesApi')

    const wrapper = mount(InvitesPanel)

    expect(wrapper.text()).toContain('Invites')
    expect(wrapper.find('#invites-panel').exists()).toBe(false)
    expect(getSpy).not.toHaveBeenCalled()
  })

  it('loads and displays invites on expand', async () => {
    const mockInvites: Invite[] = [
      { id: 'invite-1', code: 'ABC123', expires_at: '2099-01-01T00:00:00.000Z' },
      {
        id: 'invite-2',
        code: 'USEDCODE',
        expires_at: '2099-01-01T00:00:00.000Z',
        consumed_at: '2026-01-01T00:00:00.000Z',
      },
    ]
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce(mockInvites)

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ABC123')
    expect(wrapper.text()).toContain('USEDCODE')
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('Used')
  })

  it('shows an offline message instead of fetching when expanded offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const getSpy = vi.spyOn(invitesApi, 'getInvitesApi')

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')

    expect(getSpy).not.toHaveBeenCalled()
    expect(wrapper.find('.banner-error').text()).toContain('must be online')
  })

  it('shows empty state when there are no invites', async () => {
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce([])

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('No invites yet')
  })

  it('generates a new invite and prepends it to the list', async () => {
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce([])
    const newInvite: Invite = { id: 'invite-new', code: 'NEWCODE1' }
    vi.spyOn(invitesApi, 'createInviteApi').mockResolvedValueOnce(newInvite)

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    await wrapper.find('.generate-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('NEWCODE1')
  })

  it('deletes an invite after confirming', async () => {
    const mockInvite: Invite = { id: 'invite-1', code: 'ABC123' }
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce([mockInvite])
    const deleteSpy = vi.spyOn(invitesApi, 'deleteInviteApi').mockResolvedValueOnce()

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    await wrapper.find('.ticket-btn-danger').trigger('click')
    expect(wrapper.text()).toContain('Delete this invite?')

    const confirmButtons = wrapper.findAll('.ticket-btn-danger')
    await confirmButtons[confirmButtons.length - 1]?.trigger('click')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('invite-1')
    expect(wrapper.text()).toContain('No invites yet')
  })

  it('disables delete for already-used invites', async () => {
    const usedInvite: Invite = {
      id: 'invite-1',
      code: 'USEDCODE',
      consumed_at: '2026-01-01T00:00:00.000Z',
    }
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce([usedInvite])

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    const deleteBtn = wrapper.find('.ticket-btn-danger')
    expect((deleteBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows an error banner when loading invites fails', async () => {
    vi.spyOn(invitesApi, 'getInvitesApi').mockRejectedValueOnce(new Error('Network error'))

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    expect(wrapper.find('.banner-error').text()).toContain('Network error')
  })
})

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve))
}
