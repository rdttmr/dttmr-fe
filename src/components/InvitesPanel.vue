<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getInvitesApi, getInviteStatusApi, createInviteApi, deleteInviteApi } from '@/api/invites'
import type { Invite, InviteStatusCounts } from '@/types/invite'
import AppIcon from '@/components/AppIcon.vue'

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
// Counts across ALL invites (not just the current page)
const statusCounts = ref<InviteStatusCounts | null>(null)

let hasLoaded = false
let sharedTimeout: ReturnType<typeof setTimeout> | undefined

const totalInvites = computed(() =>
  statusCounts.value
    ? statusCounts.value.active + statusCounts.value.expired + statusCounts.value.used
    : null,
)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const showPagination = computed(() => totalPages.value > 1)

onMounted(() => {
  void loadStatusCounts()
})

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

async function loadStatusCounts() {
  if (isOffline()) return
  try {
    statusCounts.value = await getInviteStatusApi()
  } catch {
    // Non-critical: the header badges just stay hidden until the next
    // successful fetch instead of blocking the rest of the panel.
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
    await loadStatusCounts()
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
    await loadStatusCounts()
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
      await navigator.share({
        title: 'Join dttmr',
        text: 'Use this link to create your account',
        url,
      })
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
  <section class="card invites-card">
    <button
      type="button"
      class="invites-toggle"
      :aria-expanded="expanded"
      aria-controls="invites-panel"
      @click="toggleExpanded"
    >
      <span class="invites-toggle-icon"><AppIcon name="ticket" :size="20" /></span>
      <span class="invites-toggle-label">
        <h4>Invites</h4>
        <span v-if="statusCounts" class="invites-stats">
          <span class="invites-count-badge">{{ statusCounts.active }} active</span>
          <span class="invites-count-badge badge-expired">{{ statusCounts.expired }} expired</span>
          <span class="invites-count-badge badge-used">{{ statusCounts.used }} used</span>
          <span class="invites-total-label">{{ totalInvites }} total</span>
        </span>
      </span>
      <AppIcon name="chevron-down" class="chevron" :class="{ 'is-open': expanded }" :size="18" />
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
              <button
                type="button"
                class="ticket-btn"
                :disabled="inviteStatus(invite) !== 'active'"
                :title="
                  inviteStatus(invite) !== 'active' ? 'Only active invites can be shared' : ''
                "
                @click="shareInvite(invite)"
              >
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
          <AppIcon name="chevron-left" :size="16" :stroke="2.4" />
        </button>
        <span class="pagination-info">{{ total }} invites total</span>
        <button
          type="button"
          class="page-btn"
          :disabled="page >= totalPages || isLoading"
          aria-label="Next page"
          @click="goToPage(page + 1)"
        >
          <AppIcon name="chevron-right" :size="16" :stroke="2.4" />
        </button>
      </div>

      <p v-if="error" class="banner banner-error">{{ error }}</p>

      <button
        type="button"
        class="btn btn-primary generate-btn"
        :disabled="isCreating"
        @click="handleCreate"
      >
        <AppIcon v-if="!isCreating" name="plus" :size="17" :stroke="2.4" />
        {{ isCreating ? 'Generating…' : 'Generate invite' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.invites-card {
  padding: 0.35rem;
  background-color: var(--c-bg-soft);
}

.invites-toggle {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  padding: 0.7rem 0.75rem;
  background: none;
  border: none;
  border-radius: var(--radius-md);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s;
}

.invites-toggle:hover {
  background-color: var(--c-surface);
}

.invites-toggle-icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  background-color: var(--c-accent-bg);
  color: var(--c-accent-strong);
}

.invites-toggle-label {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
}

.invites-toggle-label h4 {
  font-size: 0.98rem;
  margin: 0;
}

.invites-stats {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.invites-count-badge {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.12rem 0.55rem;
  border-radius: 999px;
  background-color: var(--c-success-bg);
  color: var(--c-success);
}

.invites-count-badge.badge-expired {
  background-color: var(--c-danger-bg);
  color: var(--c-danger);
}

.invites-count-badge.badge-used {
  background-color: var(--c-surface-hover);
  color: var(--c-text-soft);
}

.invites-total-label {
  font-size: 0.68rem;
  color: var(--c-text-soft);
  margin-left: 0.2rem;
}

.chevron {
  flex-shrink: 0;
  color: var(--c-text-soft);
  transition: transform 0.25s var(--ease-out);
}

.chevron.is-open {
  transform: rotate(180deg);
}

.invites-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.5rem 0.75rem 0.85rem;
  animation: rise-in 0.3s var(--ease-out);
}

.invites-hint {
  font-size: 0.8rem;
  color: var(--c-text-soft);
  margin: 0;
}

.invites-loading,
.invites-empty {
  font-size: 0.88rem;
  color: var(--c-text-soft);
  margin: 0;
  padding: 0.5rem 0;
}

.invite-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

/* boarding-pass style ticket: coloured stub on the left, perforated divider */
.invite-ticket {
  position: relative;
  border: 1px solid var(--c-border);
  border-left: 4px solid var(--c-text-soft);
  border-radius: var(--radius-md);
  background-color: var(--c-surface);
  padding: 0.75rem 0.9rem;
  transition: border-color 0.2s;
}

.invite-ticket.is-active {
  border-left-color: var(--c-success);
}

.invite-ticket.is-expired {
  border-left-color: var(--c-danger);
}

.invite-ticket.is-used {
  border-left-color: var(--c-text-soft);
  opacity: 0.7;
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
  font-weight: 500;
  letter-spacing: 0.08em;
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
  font-size: 0.64rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.16rem 0.55rem;
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
  background-color: var(--c-surface-hover);
  color: var(--c-text-soft);
}

.invite-ticket-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  border-top: 1px dashed var(--c-border-hover);
  margin-top: 0.65rem;
  padding-top: 0.6rem;
}

.invite-detail {
  font-size: 0.76rem;
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
  font-size: 0.76rem;
  color: var(--c-text-soft);
}

.ticket-btn {
  background-color: var(--c-surface-hover);
  border: 1px solid transparent;
  color: var(--c-heading);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s,
    transform 0.15s var(--ease-out);
}

.ticket-btn:hover:not(:disabled) {
  background-color: var(--c-accent-bg);
  color: var(--c-accent-strong);
}

.ticket-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.ticket-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ticket-btn-danger {
  color: var(--c-danger);
}

.ticket-btn-danger:hover:not(:disabled) {
  background-color: var(--c-danger-bg);
  color: var(--c-danger);
}

.generate-btn {
  width: 100%;
}

.invites-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.pagination-info {
  font-size: 0.75rem;
  color: var(--c-text-soft);
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  background-color: var(--c-surface-hover);
  border: none;
  border-radius: 50%;
  color: var(--c-heading);
  cursor: pointer;
  transition: background-color 0.15s;
}

.page-btn:hover:not(:disabled) {
  background-color: var(--c-accent-bg);
  color: var(--c-accent-strong);
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.invites-body .banner {
  margin: 0;
}
</style>
