<script setup lang="ts">
import BrandMark from '@/components/BrandMark.vue'
</script>

<template>
  <div class="auth">
    <div class="auth-inner">
      <div class="auth-brand">
        <BrandMark :size="60" />
        <span class="wordmark">dttmr</span>
      </div>

      <div class="auth-card">
        <slot />
      </div>

      <p class="auth-foot">Offline-first · your data syncs when you're back online</p>
    </div>
  </div>
</template>

<style scoped>
.auth {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: calc(1.5rem + var(--safe-top)) 1.25rem calc(1.5rem + var(--safe-bottom));
}

.auth-inner {
  width: 100%;
  max-width: 410px;
}

.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.75rem;
  animation: rise-in 0.6s var(--ease-out) backwards;
}

.wordmark {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.04em;
  color: var(--c-heading);
}

.auth-card {
  position: relative;
  padding: 1.9rem 1.6rem 1.7rem;
  border-radius: var(--radius-xl);
  background-color: var(--c-glass);
  border: 1px solid var(--c-border-hover);
  backdrop-filter: blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  box-shadow: var(--shadow-lg);
  animation: rise-in 0.6s 0.08s var(--ease-out) backwards;
}

/* soft gradient hairline along the top edge */
.auth-card::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 12%;
  right: 12%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--c-accent-strong), transparent);
}

.auth-foot {
  margin-top: 1.4rem;
  text-align: center;
  font-size: 0.78rem;
  color: var(--c-text-soft);
  animation: rise-in 0.6s 0.16s var(--ease-out) backwards;
}

@media (min-width: 768px) {
  .auth-card {
    padding: 2.3rem 2.1rem 2rem;
  }
}
</style>
