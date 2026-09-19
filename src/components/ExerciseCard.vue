<script setup lang="ts">
import { computed } from 'vue'
import type { Exercise } from '@/types/exercise'
import AppIcon from '@/components/AppIcon.vue'
import { hueFromString } from '@/utils/hue'
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

const hue = computed(() => hueFromString(props.exercise.name))

function handleClick() {
  emit('select', props.exercise.id)
}
</script>

<template>
  <button type="button" class="exercise-card card" :style="{ '--hue': hue }" @click="handleClick">
    <span class="tile" aria-hidden="true"><AppIcon name="dumbbell" :size="21" :stroke="2" /></span>
    <div class="exercise-card-main">
      <h3>{{ exercise.name }}</h3>
      <p v-if="exercise.notes" class="notes">{{ exercise.notes }}</p>
      <div v-if="loadLabel || metricLabel || equipmentLabels.length > 0" class="tags">
        <span v-if="loadLabel" class="pill pill-accent">{{ loadLabel }}</span>
        <span v-if="metricLabel" class="pill pill-accent">{{ metricLabel }}</span>
        <span v-for="equipment in equipmentLabels" :key="equipment" class="pill">{{
          equipment
        }}</span>
      </div>
    </div>
    <AppIcon name="chevron-right" class="chevron" :size="18" />
  </button>
</template>

<style scoped>
.exercise-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 0.9rem;
  color: inherit;
  background-color: var(--c-bg-soft);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.25s var(--ease-out),
    transform 0.2s var(--ease-out);
}

.exercise-card:hover {
  border-color: var(--c-border-hover);
  box-shadow: var(--shadow-md);
}

.exercise-card:active {
  transform: scale(0.985);
}

.tile {
  flex-shrink: 0;
  align-self: flex-start;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 15px;
  color: hsl(var(--hue) 90% 74%);
  background-color: hsl(var(--hue) 80% 60% / 0.14);
  box-shadow: inset 0 0 0 1px hsl(var(--hue) 80% 65% / 0.3);
}

.exercise-card-main {
  flex: 1;
  min-width: 0;
}

.exercise-card-main h3 {
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes {
  font-size: 0.82rem;
  color: var(--c-text-soft);
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.4rem;
}

.notes + .tags {
  margin-top: 0;
}

.chevron {
  color: var(--c-text-soft);
  transition: transform 0.2s var(--ease-out);
}

.exercise-card:hover .chevron {
  transform: translateX(3px);
  color: var(--c-heading);
}
</style>
