import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ListsView from '../views/ListsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'lists',
      component: ListsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/lists/:id',
      name: 'list-detail',
      component: () => import('../views/ListDetailView.vue'),
      meta: { requiresAuth: true },
      props: true,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('../views/AccountView.vue'),
    },
    // Intentionally not linked from anywhere in the UI — reached only via an
    // invite link (see router.beforeEach below) or by typing the URL directly.
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  // An invite link may point anywhere (e.g. the app root) so it still works
  // if the recipient doesn't have the app installed/bookmarked at /register.
  if (to.name !== 'register' && typeof to.query.invite === 'string' && to.query.invite) {
    return { name: 'register', query: { invite: to.query.invite } }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  return true
})

export default router
