<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import BaseModal from '@/components/BaseModal.vue'

const props = defineProps<{
  // Used for the title/labels ("Rename list"), so one sheet serves both the
  // list and recipe detail views.
  kind: 'list' | 'recipe'
  currentName: string
}>()

const emit = defineEmits<{
  close: []
  save: [name: string]
}>()

const nameInput = ref<HTMLInputElement | null>(null)
const newName = ref(props.currentName)

const trimmedName = computed(() => newName.value.trim())
const canSave = computed(() => trimmedName.value !== '')

onMounted(() => {
  nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
})

function handleClose() {
  emit('close')
}

function handleSave() {
  if (!canSave.value) return
  // An unchanged name is a no-op: skip the store write and sync round trip.
  if (trimmedName.value === props.currentName) {
    emit('close')
    return
  }
  emit('save', trimmedName.value)
}
</script>

<template>
  <BaseModal
    :title="`Rename ${kind}`"
    title-id="rename-modal-title"
    icon="edit"
    @close="handleClose"
  >
    <form id="rename-form" @submit.prevent="handleSave">
      <div class="field">
        <input
          ref="nameInput"
          v-model="newName"
          type="text"
          :placeholder="`${kind === 'list' ? 'List' : 'Recipe'} name`"
          :aria-label="`${kind === 'list' ? 'List' : 'Recipe'} name`"
          autocomplete="off"
        />
      </div>
    </form>

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="handleClose">Cancel</button>
      <button type="submit" form="rename-form" class="btn btn-primary" :disabled="!canSave">
        Save
      </button>
    </template>
  </BaseModal>
</template>
