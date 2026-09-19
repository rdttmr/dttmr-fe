<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getExercisesApi } from '@/api/exercises'
import type { Exercise } from '@/types/exercise'
import AppIcon from '@/components/AppIcon.vue'
import ExerciseCard from '@/components/ExerciseCard.vue'

const PAGE_SIZE = 20

const exercises = ref<Exercise[]>([])
const page = ref(1)
const total = ref(0)
const isLoading = ref(false)
const error = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const showPagination = computed(() => totalPages.value > 1)

onMounted(() => {
  void loadExercises()
})

async function loadExercises() {
  error.value = ''
  isLoading.value = true
  try {
    const response = await getExercisesApi({ page: page.value, count: PAGE_SIZE })
    exercises.value = response.data
    total.value = response.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load exercises'
  } finally {
    isLoading.value = false
  }
}

async function goToPage(target: number) {
  if (target < 1 || target > totalPages.value || target === page.value || isLoading.value) {
    return
  }
  page.value = target
  await loadExercises()
}

// No workout/workout-template flow exists yet to receive a selection; this
// is the attachment point future "add exercise to workout" UI will use.
function handleSelectExercise() {}
</script>

<template>
  <main class="page">
    <header class="page-head">
      <p class="eyebrow">Library</p>
      <h1>Exercises</h1>
      <p v-if="total > 0" class="page-sub">
        <span class="mono-num">{{ total }}</span> movements to build workouts from
      </p>
    </header>

    <p v-if="error" class="banner banner-error exercise-error">{{ error }}</p>

    <ul v-if="isLoading && exercises.length === 0" class="exercises" aria-label="Loading exercises">
      <li v-for="n in 5" :key="n" class="skeleton" :style="{ '--i': n }"></li>
    </ul>

    <ul v-else-if="exercises.length > 0" :key="page" class="exercises stagger">
      <li
        v-for="(exercise, index) in exercises"
        :key="exercise.id"
        :style="{ '--i': Math.min(index, 8) }"
      >
        <ExerciseCard :exercise="exercise" @select="handleSelectExercise" />
      </li>
    </ul>

    <div v-else class="empty-state">
      <span class="empty-icon"><AppIcon name="dumbbell" :size="34" :stroke="1.7" /></span>
      <p class="empty-title">No exercises yet</p>
      <p class="empty-hint">Exercises will show up here once they're added.</p>
    </div>

    <div v-if="showPagination" class="pagination">
      <button
        type="button"
        class="page-btn"
        :disabled="page <= 1 || isLoading"
        aria-label="Previous page"
        @click="goToPage(page - 1)"
      >
        <AppIcon name="chevron-left" :size="18" :stroke="2.4" />
      </button>
      <span class="pagination-info mono-num">{{ page }} / {{ totalPages }}</span>
      <button
        type="button"
        class="page-btn"
        :disabled="page >= totalPages || isLoading"
        aria-label="Next page"
        @click="goToPage(page + 1)"
      >
        <AppIcon name="chevron-right" :size="18" :stroke="2.4" />
      </button>
    </div>
  </main>
</template>

<style scoped>
.exercise-error {
  margin-top: 1rem;
}

.exercises {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  list-style: none;
  padding: 0;
  margin: 1.25rem 0 0;
}

.skeleton {
  height: 78px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--c-border);
  background-color: var(--c-surface);
  background-image: linear-gradient(
    100deg,
    transparent 30%,
    var(--c-surface-hover) 50%,
    transparent 70%
  );
  background-size: 250% 100%;
  animation: shimmer 1.4s linear infinite;
  animation-delay: calc(var(--i, 0) * 80ms);
}

@keyframes shimmer {
  from {
    background-position: 150% 0;
  }
  to {
    background-position: -100% 0;
  }
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  width: fit-content;
  margin: 1.5rem auto 0;
  padding: 0.35rem;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  background-color: var(--c-surface);
}

.pagination-info {
  min-width: 4.5rem;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--c-heading);
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  background-color: var(--c-surface-hover);
  border: none;
  border-radius: 50%;
  color: var(--c-heading);
  cursor: pointer;
  transition:
    background-color 0.15s,
    transform 0.15s var(--ease-out);
}

.page-btn:hover:not(:disabled) {
  background-image: var(--grad-accent);
  color: #fff;
}

.page-btn:active:not(:disabled) {
  transform: scale(0.9);
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
