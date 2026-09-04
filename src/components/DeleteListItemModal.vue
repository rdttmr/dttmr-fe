<script setup lang="ts">
import type { LocalListItem } from '@/database/db'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'

const props = defineProps<{
  item: LocalListItem
}>()

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
  <ConfirmDeleteModal
    :title="`Delete &quot;${props.item.title}&quot;?`"
    description="Are you sure you want to delete this item? This action cannot be undone."
    confirm-label="Delete item"
    @close="handleClose"
    @confirm="handleConfirm"
  />
</template>
