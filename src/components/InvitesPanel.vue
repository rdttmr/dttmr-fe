<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { getInvitesApi, createInviteApi, deleteInviteApi } from '@/api/invites'
import type { Invite } from '@/types/invite'

type InviteStatus = 'active' | 'used' | 'expired'

const PAGE_SIZE = 10

const expanded = ref(false)
const invites = ref<Invite[]>([])
const page = ref(1)
const total = ref(0)
const isLoading = ref(false)
const isCreating = ref(false)
const error = ref('')
const pendingDeleteId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const sharedId = ref<string | null>(null)

let hasLoaded = false
let sharedTimeout: ReturnType<typeof setTimeout> | undefined

const activeCount = computed(
  () => invites.value.filter((invite) => inviteStatus(invite) === 'active').length,
)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const showPagination = computed(() => totalPages.value > 1)

onBeforeUnmount(() => {
  clearTimeout(sharedTimeout)
})

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

async function toggleExpanded() {
  expanded.value = !expanded.value
  if (expanded.value && !hasLoaded) {
    await loadInvites()
  }
}

async function loadInvites() {
  error.value = ''
  if (isOffline()) {
    error.value = 'You must be online to manage invites.'
    return
  }

  isLoading.value = true
  try {
    const response = await getInvitesApi({ page: page.value, count: PAGE_SIZE })
    invites.value = response.data
    total.value = response.total
    hasLoaded = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load invites'
  } finally {
    isLoading.value = false
  }
}

async function goToPage(target: number) {
  if (target < 1 || target > totalPages.value || target === page.value || isLoading.value) {
    return
  }
  page.value = target
  await loadInvites()
}

async function handleCreate() {
  error.value = ''
  if (isOffline()) {
    error.value = 'You must be online to create an invite.'
    return
  }

  isCreating.value = true
  try {
    const invite = await createInviteApi()
    page.value = 1
    await loadInvites()
    // Sharing is the whole point of an invite, so offer it immediately
    // instead of making the user hunt for the Share button afterwards.
    await shareInvite(invite)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create invite'
  } finally {
    isCreating.value = false
  }
}

function requestDelete(id: string) {
  error.value = ''
  pendingDeleteId.value = id
}

function cancelDelete() {
  pendingDeleteId.value = null
}

async function confirmDelete(id: string) {
  error.value = ''
  if (isOffline()) {
    error.value = 'You must be online to delete an invite.'
    pendingDeleteId.value = null
    return
  }

  deletingId.value = id
  try {
    await deleteInviteApi(id)
    // Deleted the only item on a page past the first: step back a page
    // instead of reloading into a stranded, empty page.
    if (invites.value.length === 1 && page.value > 1) {
      page.value -= 1
    }
    await loadInvites()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete invite'
  } finally {
    deletingId.value = null
    pendingDeleteId.value = null
  }
}

// The link that lands someone on the (otherwise unlinked) register page —
// see router.beforeEach, which redirects any URL carrying ?invite=... there.
function getInviteUrl(code: string): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`
  return `${base}?invite=${encodeURIComponent(code)}`
}

async function shareInvite(invite: Invite) {
  const url = getInviteUrl(invite.code)

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Join dttmr', text: 'Use this link to create your account', url })
      return
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      // Web Share unsupported in this context; fall through to clipboard copy.
    }
  }

  try {
    await navigator.clipboard.writeText(url)
    sharedId.value = invite.id
    clearTimeout(sharedTimeout)
    sharedTimeout = setTimeout(() => {
      sharedId.value = null
    }, 1500)
  } catch {
    // Clipboard access denied or unavailable; nothing sensible to do.
  }
}

function inviteStatus(invite: Invite): InviteStatus {
  if (invite.consumed_at) return 'used'
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return 'expired'
  return 'active'
}

function statusLabel(invite: Invite): string {
  const status = inviteStatus(invite)
  return status === 'used' ? 'Used' : status === 'expired' ? 'Expired' : 'Active'
}

// Standard "time ago"/"time until" formatter: walk unit divisions until the
// duration fits in one, so both past and future dates read naturally.
function formatRelative(dateStr: string): string {
  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'seconds'],
    [60, 'minutes'],
    [24, 'hours'],
    [7, 'days'],
    [4.34524, 'weeks'],
    [12, 'months'],
    [Number.POSITIVE_INFINITY, 'years'],
  ]
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  let duration = (new Date(dateStr).getTime() - Date.now()) / 1000
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return rtf.format(Math.round(duration), unit)
    }
    duration /= amount
  }
  return rtf.format(Math.round(duration), 'years')
}

function inviteDetail(invite: Invite): string {
  const status = inviteStatus(invite)
  if (status === 'used') {
    return invite.consumed_at ? `Used ${formatRelative(invite.consumed_at)}` : 'Used'
  }
  if (!invite.expires_at) {
    return 'No expiry'
  }
  return `${status === 'expired' ? 'Expired' : 'Expires'} ${formatRelative(invite.expires_at)}`
}
</script>

<template>
  <section class="card info-card invites-card">
    <button
      type="button"
      class="invites-toggle"
      :aria-expanded="expanded"
      aria-controls="invites-panel"
      @click="toggleExpanded"
    >
      <span class="invites-toggle-label">
        <h4>Invites</h4>
        <span v-if="activeCount > 0" class="invites-count-badge">{{ activeCount }} active</span>
      </span>
      <span class="chevron" :class="{ 'is-open': expanded }" aria-hidden="true">⌄</span>
    </button>

    <div v-if="expanded" id="invites-panel" class="invites-body">
      <p class="invites-hint">
        Invite codes let someone new create an account. Creating, listing, and deleting invites
        requires an internet connection.
      </p>

      <p v-if="isLoading" class="invites-loading">Loading invites…</p>

      <ul v-else-if="invites.length > 0" class="invite-list">
        <li
          v-for="invite in invites"
          :key="invite.id"
          class="invite-ticket"
          :class="`is-${inviteStatus(invite)}`"
        >
          <div class="invite-ticket-main">
            <code class="invite-code" :title="invite.code">{{ invite.code }}</code>
            <span class="invite-status-pill" :class="`pill-${inviteStatus(invite)}`">{{
              statusLabel(invite)
            }}</span>
          </div>
          <div class="invite-ticket-meta">
            <span class="invite-detail">{{ inviteDetail(invite) }}</span>

            <div v-if="pendingDeleteId !== invite.id" class="invite-actions">
              <button type="button" class="ticket-btn" @click="shareInvite(invite)">
                {{ sharedId === invite.id ? 'Copied!' : 'Share' }}
              </button>
              <button
                type="button"
                class="ticket-btn ticket-btn-danger"
                :disabled="inviteStatus(invite) === 'used'"
                :title="inviteStatus(invite) === 'used' ? 'Used invites cannot be deleted' : ''"
                @click="requestDelete(invite.id)"
              >
                Delete
              </button>
            </div>
            <div v-else class="invite-actions">
              <span class="confirm-label">Delete this invite?</span>
              <button type="button" class="ticket-btn" @click="cancelDelete">No</button>
              <button
                type="button"
                class="ticket-btn ticket-btn-danger"
                :disabled="deletingId === invite.id"
                @click="confirmDelete(invite.id)"
              >
                {{ deletingId === invite.id ? 'Deleting…' : 'Yes' }}
              </button>
            </div>
          </div>
        </li>
      </ul>

      <p v-else class="invites-empty">No invites yet. Generate one to invite someone.</p>

      <div v-if="showPagination" class="invites-pagination">
        <button
          type="button"
          class="page-btn"
          :disabled="page <= 1 || isLoading"
          aria-label="Previous page"
          @click="goToPage(page - 1)"
        >
          ‹
        </button>
        <span class="pagination-info">{{ total }} invites total</span>
        <button
          type="button"
          class="page-btn"
          :disabled="page >= totalPages || isLoading"
          aria-label="Next page"
          @click="goToPage(page + 1)"
        >
          ›
        </button>
      </div>

      <p v-if="error" class="banner banner-error">{{ error }}</p>

      <button
        type="button"
        class="btn btn-primary generate-btn"
        :disabled="isCreating"
        @click="handleCreate"
      >
        {{ isCreating ? 'Generating…' : '+ Generate invite' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.invites-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.invites-toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.invites-toggle-label h4 {
  font-size: 0.85rem;
  margin: 0;
}

.invites-count-badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background-color: var(--c-accent-bg);
  color: var(--c-accent-strong);
}

.chevron {
  color: var(--c-text-soft);
  transition: transform 0.15s ease-in-out;
}

.chevron.is-open {
  transform: rotate(180deg);
}

.invites-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.invites-hint {
  font-size: 0.8rem;
  color: var(--c-text-soft);
  margin: 0;
}

.invites-loading,
.invites-empty {
  font-size: 0.85rem;
  color: var(--c-text-soft);
  margin: 0;
}

.invite-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.invite-ticket {
  border: 1px solid var(--c-border);
  border-left: 3px solid var(--c-text-soft);
  border-radius: var(--radius-md);
  background-color: var(--c-bg-mute);
  padding: 0.65rem 0.85rem;
}

.invite-ticket.is-active {
  border-left-color: var(--c-success);
}

.invite-ticket.is-expired {
  border-left-color: var(--c-danger);
}

.invite-ticket.is-used {
  border-left-color: var(--c-text-soft);
  opacity: 0.75;
}

.invite-ticket-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.invite-code {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  color: var(--c-heading);
  flex: 1 1 auto;
  min-width: 0;
  max-width: 24ch;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

@media (min-width: 768px) {
  .invite-code {
    max-width: 80ch;
  }
}

.invite-status-pill {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.pill-active {
  background-color: var(--c-success-bg);
  color: var(--c-success);
}

.pill-expired {
  background-color: var(--c-danger-bg);
  color: var(--c-danger);
}

.pill-used {
  background-color: var(--c-bg-elevated);
  color: var(--c-text-soft);
}

.invite-ticket-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.5rem;
  flex-wrap: wrap;
  border-top: 1px dashed var(--c-border);
  margin-top: 0.55rem;
  padding-top: 0.5rem;
}

.invite-detail {
  font-size: 0.75rem;
  color: var(--c-text-soft);
  min-width: 0;
}

.invite-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.confirm-label {
  font-size: 0.75rem;
  color: var(--c-text-soft);
}

.ticket-btn {
  background: none;
  border: 1px solid var(--c-border);
  color: var(--c-text);
  font-size: 0.72rem;
  padding: 0.25rem 0.55rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.ticket-btn:hover:not(:disabled) {
  border-color: var(--c-border-hover);
  color: var(--c-heading);
}

.ticket-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ticket-btn-danger {
  color: var(--c-danger);
  border-color: rgba(193, 97, 74, 0.4);
}

.ticket-btn-danger:hover:not(:disabled) {
  background-color: var(--c-danger-bg);
}

.generate-btn {
  width: auto;
  align-self: flex-start;
  padding: 0.55rem 1.1rem;
}

.invites-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
}

.pagination-info {
  font-size: 0.72rem;
  color: var(--c-text-soft);
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  background: none;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  color: var(--c-text);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--c-border-hover);
  color: var(--c-heading);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
