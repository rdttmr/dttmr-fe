<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 30 })
</script>

<template>
  <svg class="brand-mark" viewBox="0 0 32 32" :width="size" :height="size" aria-hidden="true">
    <defs>
      <linearGradient id="brand-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#9a72ff" />
        <stop offset="0.55" stop-color="#5b7dff" />
        <stop offset="1" stop-color="#34c3f5" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="10" fill="url(#brand-grad)" />
    <path
      d="M18.5 8v10.6a4.6 4.6 0 1 1-2.2-3.9"
      fill="none"
      stroke="#fff"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.brand-mark {
  display: block;
  filter: drop-shadow(0 6px 16px rgba(99, 102, 255, 0.5));
}
</style>
