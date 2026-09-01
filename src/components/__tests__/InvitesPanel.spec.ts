import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import InvitesPanel from '../InvitesPanel.vue'
import * as invitesApi from '@/api/invites'
import type { Invite, PaginatedInvites } from '@/types/invite'

function paginated(data: Invite[], total = data.length): PaginatedInvites {
  return { data, total, count: data.length }
}

describe('InvitesPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined) },
      configurable: true,
    })
    // jsdom has no Web Share API; tests that want it define it explicitly.
    Reflect.deleteProperty(navigator, 'share')
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
    const getSpy = vi
      .spyOn(invitesApi, 'getInvitesApi')
      .mockResolvedValueOnce(paginated(mockInvites))

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    expect(getSpy).toHaveBeenCalledWith({ page: 1, count: 10 })
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
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce(paginated([]))

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('No invites yet')
  })

  it('does not show pagination controls when everything fits on one page', async () => {
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce(
      paginated([{ id: 'invite-1', code: 'ABC123' }], 1),
    )

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    expect(wrapper.find('.invites-pagination').exists()).toBe(false)
  })

  it('shows pagination controls and total count when there is more than one page', async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => ({ id: `invite-${i}`, code: `CODE${i}` }))
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce(paginated(page1, 15))

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    expect(wrapper.find('.invites-pagination').text()).toContain('15 invites total')
    const [prevBtn, nextBtn] = wrapper.findAll('.page-btn')
    expect((prevBtn!.element as HTMLButtonElement).disabled).toBe(true)
    expect((nextBtn!.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('navigates to the next page when the forward button is clicked', async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => ({ id: `invite-${i}`, code: `CODE${i}` }))
    const page2 = [{ id: 'invite-10', code: 'CODE10' }]
    const getSpy = vi
      .spyOn(invitesApi, 'getInvitesApi')
      .mockResolvedValueOnce(paginated(page1, 11))
      .mockResolvedValueOnce(paginated(page2, 11))

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    const [, nextBtn] = wrapper.findAll('.page-btn')
    await nextBtn?.trigger('click')
    await flushPromises()

    expect(getSpy).toHaveBeenLastCalledWith({ page: 2, count: 10 })
    expect(wrapper.text()).toContain('CODE10')
    const [prevBtn, nextBtnAfter] = wrapper.findAll('.page-btn')
    expect((prevBtn!.element as HTMLButtonElement).disabled).toBe(false)
    expect((nextBtnAfter!.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('generates a new invite, reloads page one, and prepends it to the list', async () => {
    const newInvite: Invite = { id: 'invite-new', code: 'NEWCODE1' }
    vi.spyOn(invitesApi, 'getInvitesApi')
      .mockResolvedValueOnce(paginated([]))
      .mockResolvedValueOnce(paginated([newInvite]))
    vi.spyOn(invitesApi, 'createInviteApi').mockResolvedValueOnce(newInvite)

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    await wrapper.find('.generate-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('NEWCODE1')
  })

  it('shares the newly created invite automatically', async () => {
    const newInvite: Invite = { id: 'invite-new', code: 'NEWCODE1' }
    vi.spyOn(invitesApi, 'getInvitesApi')
      .mockResolvedValueOnce(paginated([]))
      .mockResolvedValueOnce(paginated([newInvite]))
    vi.spyOn(invitesApi, 'createInviteApi').mockResolvedValueOnce(newInvite)

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    await wrapper.find('.generate-btn').trigger('click')
    await flushPromises()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('?invite=NEWCODE1'),
    )
  })

  it('shares an existing invite link via the clipboard when Web Share is unavailable', async () => {
    const mockInvite: Invite = { id: 'invite-1', code: 'ABC123' }
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce(paginated([mockInvite]))

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    await wrapper.find('.ticket-btn').trigger('click')
    await flushPromises()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('?invite=ABC123'),
    )
    expect(wrapper.text()).toContain('Copied!')
  })

  it('uses the Web Share API instead of the clipboard when available', async () => {
    const shareMock = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true })

    const mockInvite: Invite = { id: 'invite-1', code: 'ABC123' }
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce(paginated([mockInvite]))

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    await wrapper.find('.ticket-btn').trigger('click')
    await flushPromises()

    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('?invite=ABC123') }),
    )
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('deletes an invite after confirming', async () => {
    const mockInvite: Invite = { id: 'invite-1', code: 'ABC123' }
    vi.spyOn(invitesApi, 'getInvitesApi')
      .mockResolvedValueOnce(paginated([mockInvite]))
      .mockResolvedValueOnce(paginated([]))
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

  it('steps back a page when deleting the last item on a page past the first', async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => ({ id: `invite-${i}`, code: `CODE${i}` }))
    const page2 = [{ id: 'invite-10', code: 'CODE10' }]
    const getSpy = vi
      .spyOn(invitesApi, 'getInvitesApi')
      .mockResolvedValueOnce(paginated(page1, 11))
      .mockResolvedValueOnce(paginated(page2, 11))
      .mockResolvedValueOnce(paginated(page1, 10))
    vi.spyOn(invitesApi, 'deleteInviteApi').mockResolvedValueOnce()

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    const [, nextBtn] = wrapper.findAll('.page-btn')
    await nextBtn?.trigger('click')
    await flushPromises()

    await wrapper.find('.ticket-btn-danger').trigger('click')
    const confirmButtons = wrapper.findAll('.ticket-btn-danger')
    await confirmButtons[confirmButtons.length - 1]?.trigger('click')
    await flushPromises()

    expect(getSpy).toHaveBeenLastCalledWith({ page: 1, count: 10 })
  })

  it('disables delete for already-used invites', async () => {
    const usedInvite: Invite = {
      id: 'invite-1',
      code: 'USEDCODE',
      consumed_at: '2026-01-01T00:00:00.000Z',
    }
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce(paginated([usedInvite]))

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    const deleteBtn = wrapper.find('.ticket-btn-danger')
    expect((deleteBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables share for used and expired invites, but leaves expired invites deletable', async () => {
    const usedInvite: Invite = {
      id: 'invite-1',
      code: 'USEDCODE',
      consumed_at: '2026-01-01T00:00:00.000Z',
    }
    const expiredInvite: Invite = {
      id: 'invite-2',
      code: 'EXPCODE',
      expires_at: '2020-01-01T00:00:00.000Z',
    }
    vi.spyOn(invitesApi, 'getInvitesApi').mockResolvedValueOnce(
      paginated([usedInvite, expiredInvite]),
    )

    const wrapper = mount(InvitesPanel)
    await wrapper.find('.invites-toggle').trigger('click')
    await flushPromises()

    const shareButtons = wrapper.findAll('.ticket-btn:not(.ticket-btn-danger)')
    expect((shareButtons[0]!.element as HTMLButtonElement).disabled).toBe(true)
    expect((shareButtons[1]!.element as HTMLButtonElement).disabled).toBe(true)

    const deleteButtons = wrapper.findAll('.ticket-btn-danger')
    expect((deleteButtons[0]!.element as HTMLButtonElement).disabled).toBe(true)
    expect((deleteButtons[1]!.element as HTMLButtonElement).disabled).toBe(false)
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
