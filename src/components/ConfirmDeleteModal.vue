<script setup lang="ts">
import BaseModal from '@/components/BaseModal.vue'

withDefaults(
  defineProps<{
    title: string
    description: string
    confirmLabel?: string
  }>(),
  {
    confirmLabel: 'Delete',
  },
)

const emit = defineEmits<{
  close: []
  confirm: []
}>()

function handleClose() {
  emit('close')
}

function handleConfirm() {
  emit('confirm')
}
</script>

<template>
  <BaseModal
    :title="title"
    title-id="confirm-delete-modal-title"
    icon="trash"
    tone="danger"
    @close="handleClose"
  >
    <p class="modal-description">{{ description }}</p>

    <template #footer>
      <button type="button" class="btn btn-secondary cancel-btn" @click="handleClose">
        Cancel
      </button>
      <button type="button" class="btn btn-danger confirm-delete-btn" @click="handleConfirm">
        {{ confirmLabel }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-description {
  font-size: 0.92rem;
  color: var(--c-text);
  line-height: 1.55;
}
</style>
