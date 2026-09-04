<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getExercisesApi } from '@/api/exercises'
import type { Exercise } from '@/types/exercise'
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
    <h1>Exercises</h1>

    <p v-if="error" class="banner banner-error">{{ error }}</p>

    <p v-if="isLoading && exercises.length === 0" class="loading-text">Loading exercises…</p>

    <ul v-else-if="exercises.length > 0" class="exercises">
      <li v-for="exercise in exercises" :key="exercise.id">
        <ExerciseCard :exercise="exercise" @select="handleSelectExercise" />
      </li>
    </ul>

    <div v-else class="empty-state">
      <p>No exercises yet</p>
    </div>

    <div v-if="showPagination" class="pagination">
      <button
        type="button"
        class="page-btn"
        :disabled="page <= 1 || isLoading"
        aria-label="Previous page"
        @click="goToPage(page - 1)"
      >
        ‹
      </button>
      <span class="pagination-info mono-num"
        >Page {{ page }} of {{ totalPages }} · {{ total }} total</span
      >
      <button
        type="button"
        class="page-btn"
        :disabled="page >= totalPages || isLoading"
        aria-label="Next page"
        @click="goToPage(page + 1)"
      >
        ›
      </button>
    </div>
  </main>
</template>

<style scoped>
h1 {
  font-size: 1.4rem;
  margin-bottom: 1rem;
}

.loading-text,
.empty-state {
  color: var(--c-text-soft);
  font-size: 0.9rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
}

.exercises {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.pagination-info {
  font-size: 0.78rem;
  color: var(--c-text-soft);
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: none;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  color: var(--c-text);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--c-border-hover);
  color: var(--c-heading);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
