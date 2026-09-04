<script setup lang="ts">
import { computed } from 'vue'
import type { Exercise } from '@/types/exercise'
import { EQUIPMENT_LABELS, LOAD_LABELS, METRIC_LABELS } from '@/types/exercise'

const props = defineProps<{ exercise: Exercise }>()
const emit = defineEmits<{
  select: [id: string]
}>()

const equipmentLabels = computed(
  () => props.exercise.equipment?.map((equipment) => EQUIPMENT_LABELS[equipment]) ?? [],
)
const loadLabel = computed(() =>
  props.exercise.load !== undefined ? LOAD_LABELS[props.exercise.load] : null,
)
const metricLabel = computed(() =>
  props.exercise.metric !== undefined ? METRIC_LABELS[props.exercise.metric] : null,
)

function handleClick() {
  emit('select', props.exercise.id)
}
</script>

<template>
  <button type="button" class="exercise-card card" @click="handleClick">
    <div class="exercise-card-main">
      <h3>{{ exercise.name }}</h3>
      <p v-if="exercise.notes" class="notes">{{ exercise.notes }}</p>
      <div v-if="loadLabel || metricLabel || equipmentLabels.length > 0" class="tags">
        <span v-if="loadLabel" class="tag tag-accent">{{ loadLabel }}</span>
        <span v-if="metricLabel" class="tag tag-accent">{{ metricLabel }}</span>
        <span v-for="equipment in equipmentLabels" :key="equipment" class="tag">{{
          equipment
        }}</span>
      </div>
    </div>
    <span class="chevron">›</span>
  </button>
</template>

<style scoped>
.exercise-card {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  color: inherit;
  background-color: var(--c-bg-soft);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease-in-out;
}

.exercise-card:hover {
  border-color: var(--c-border-hover);
}

.exercise-card-main {
  flex: 1;
  min-width: 0;
}

.exercise-card-main h3 {
  font-size: 1.02rem;
  margin-bottom: 0.2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes {
  font-size: 0.8rem;
  color: var(--c-text-soft);
  margin-bottom: 0.4rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag {
  font-size: 0.68rem;
  font-weight: 500;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background-color: var(--c-bg-mute);
  color: var(--c-text-soft);
}

.tag-accent {
  background-color: var(--c-accent-bg);
  color: var(--c-accent-strong);
}

.chevron {
  flex-shrink: 0;
  color: var(--c-text-soft);
  font-size: 1.3rem;
  line-height: 1;
  padding-right: 0.25rem;
}
</style>
