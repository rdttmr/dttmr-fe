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
// app becomes online again, and once eagerly on startup.
const listsStore = useListsStore()
const recipesStore = useRecipesStore()
const groupsStore = useGroupsStore()
window.addEventListener('online', () => {
  void groupsStore.sync()
  void listsStore.sync()
  void recipesStore.sync()
})
void groupsStore.ensureLoaded().then(() => groupsStore.sync())
void listsStore.sync()
void recipesStore.sync()
