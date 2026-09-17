<script setup lang="ts">
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
  }>(),
  {
    wide: false,
    scrollable: false,
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
      class="modal-card card"
      :class="{ 'is-wide': wide, 'is-scrollable': scrollable }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <div class="modal-header">
        <h3 :id="titleId">{{ title }}</h3>
        <button type="button" class="close-btn" aria-label="Close modal" @click="handleClose">
          ✕
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
  background-color: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 100;
  animation: fadeIn 0.15s ease-out;
}

.modal-card {
  width: 100%;
  max-width: 440px;
  background-color: var(--c-bg-soft);
  border: 1px solid var(--c-border-hover);
  border-radius: var(--radius-lg);
  padding: 1.25rem 1.4rem;
  box-shadow: var(--shadow-md);
  animation: slideUp 0.15s ease-out;
}

.modal-card.is-wide {
  max-width: 560px;
}

.modal-card.is-scrollable {
  display: flex;
  flex-direction: column;
  max-height: min(640px, calc(100vh - 2rem));
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

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}

.modal-header h3 {
  font-size: 1.1rem;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--c-text-soft);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius-sm);
  line-height: 1;
}

.close-btn:hover {
  color: var(--c-heading);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1rem;
  flex-shrink: 0;
}

.modal-footer .btn {
  width: auto;
  padding: 0.5rem 1.2rem;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
