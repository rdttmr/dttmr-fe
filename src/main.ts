import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useListsStore } from './stores/lists'
import { useRecipesStore } from './stores/recipes'
import { useGroupsStore } from './stores/groups'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Offline-first sync: attempt to flush the pending sync queue whenever the
// app becomes online again, and once eagerly on startup. Coming back to the
// foreground is when an installed PWA's data has most likely gone stale, so
// that syncs too; each store only re-pulls once its last pull is no longer
// fresh (utils/pullFreshness.ts).
const listsStore = useListsStore()
const recipesStore = useRecipesStore()
const groupsStore = useGroupsStore()
function syncAll() {
  void groupsStore.sync()
  void listsStore.sync()
  void recipesStore.sync()
}
window.addEventListener('online', syncAll)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncAll()
})
void groupsStore.ensureLoaded().then(() => groupsStore.sync())
void listsStore.sync()
void recipesStore.sync()
