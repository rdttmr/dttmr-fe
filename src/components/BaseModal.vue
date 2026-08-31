<script setup lang="ts">
import { useEscapeKey } from '@/composables/useEscapeKey'

defineProps<{
  title: string
  titleId: string
}>()

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
    <div class="modal-card card" role="dialog" aria-modal="true" :aria-labelledby="titleId">
      <div class="modal-header">
        <h3 :id="titleId">{{ title }}</h3>
        <button type="button" class="close-btn" aria-label="Close modal" @click="handleClose">
          ✕
        </button>
      </div>

      <slot />

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

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
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
