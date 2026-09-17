<script setup lang="ts">
import type { LocalRecipe } from '@/database/db'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'

const props = defineProps<{
  recipe: LocalRecipe
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
    :title="`Delete &quot;${props.recipe.name}&quot;?`"
    description="Are you sure you want to delete this recipe? This action cannot be undone. The list items themselves won't be deleted."
    confirm-label="Delete recipe"
    @close="handleClose"
    @confirm="handleConfirm"
  />
</template>
