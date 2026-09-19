<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import type { IconName } from '@/components/AppIcon.vue'
import { useEscapeKey } from '@/composables/useEscapeKey'

withDefaults(
  defineProps<{
    title: string
    titleId: string
    // Widens the card for content that benefits from more horizontal room
    // (e.g. a two-level picker), without affecting the default modals.
    wide?: boolean
    // Caps the card to the viewport height and lets the body slot scroll on
    // its own (header/footer stay put), instead of the card growing to fit
    // its content and getting clipped off-screen once that content is
    // taller than the viewport.
    scrollable?: boolean
    // Optional glyph shown in a tinted badge next to the title.
    icon?: IconName
    tone?: 'default' | 'danger'
  }>(),
  {
    wide: false,
    scrollable: false,
    icon: undefined,
    tone: 'default',
  },
)

const emit = defineEmits<{
  close: []
}>()

useEscapeKey(handleClose)

function handleClose() {
  emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div
      class="modal-card"
      :class="[{ 'is-wide': wide, 'is-scrollable': scrollable }, `tone-${tone}`]"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <span class="sheet-grip" aria-hidden="true"></span>

      <div class="modal-header">
        <span v-if="icon" class="modal-badge" aria-hidden="true">
          <AppIcon :name="icon" :size="20" />
        </span>
        <h3 :id="titleId">{{ title }}</h3>
        <button
          type="button"
          class="close-btn icon-btn"
          aria-label="Close modal"
          @click="handleClose"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <slot />
      </div>

      <div class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background-color: rgba(6, 7, 14, 0.62);
  backdrop-filter: blur(10px) saturate(1.2);
  -webkit-backdrop-filter: blur(10px) saturate(1.2);
  animation: fade-in 0.2s ease-out;
}

.modal-card {
  position: relative;
  width: 100%;
  max-width: 480px;
  padding: 0.6rem 1.4rem calc(1.4rem + var(--safe-bottom));
  background-color: var(--c-bg-soft);
  border: 1px solid var(--c-border-hover);
  border-bottom: none;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-lg);
  animation: sheet-up 0.34s var(--ease-out);
}

.modal-card.tone-danger::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: linear-gradient(90deg, transparent, var(--c-danger), transparent);
}

.modal-card.is-wide {
  max-width: 580px;
}

.modal-card.is-scrollable {
  display: flex;
  flex-direction: column;
  height: min(680px, 88vh);
}

/* Caps the body to the remaining card height and hands off scrolling to
   whatever the caller puts inside it, rather than scrolling the whole body
   itself - a caller with pinned content above a long list (e.g. a search
   field) structures its own slot content as a flex column with the
   scrollable part taking `flex: 1; min-height: 0; overflow-y: auto`. */
.modal-card.is-scrollable .modal-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sheet-grip {
  display: block;
  width: 38px;
  height: 4px;
  margin: 0 auto 0.85rem;
  border-radius: 4px;
  background-color: var(--c-border-hover);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.6rem;
  flex-shrink: 0;
}

.modal-header h3 {
  flex: 1;
  min-width: 0;
  font-family: var(--font-display);
  font-size: 1.3rem;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.modal-badge {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  background-color: var(--c-accent-bg);
  color: var(--c-accent-strong);
}

.tone-danger .modal-badge {
  background-color: var(--c-danger-bg);
  color: var(--c-danger);
}

.close-btn {
  margin-right: -0.4rem;
  background-color: var(--c-surface);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.1rem;
  flex-shrink: 0;
}

.modal-footer:empty {
  display: none;
}

.modal-footer .btn {
  flex: 1;
  width: auto;
}

@media (min-width: 640px) {
  .modal-overlay {
    align-items: center;
    padding: 1rem;
  }

  .modal-card {
    padding: 1.6rem 1.7rem 1.5rem;
    border-bottom: 1px solid var(--c-border-hover);
    border-radius: var(--radius-xl);
    animation: modal-pop 0.3s var(--ease-out);
  }

  .modal-card.tone-danger::before {
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  .sheet-grip {
    display: none;
  }

  .modal-card.is-scrollable {
    height: min(640px, calc(100vh - 2rem));
  }

  .modal-footer .btn {
    flex: 0 0 auto;
    padding: 0.65rem 1.4rem;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}

@keyframes sheet-up {
  from {
    transform: translateY(100%);
  }
}

@keyframes modal-pop {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
}
</style>
