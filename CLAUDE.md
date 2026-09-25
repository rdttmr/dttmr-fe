# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev                 # Vite dev server; proxies /api -> http://localhost:8080 (the Go backend)
npm run build               # type-check (vue-tsc --build) + vite build, run in parallel
npm run type-check          # vue-tsc only
npm run lint                # oxlint --fix, then eslint --fix (both auto-fix)
npm run format              # prettier --write src/
npm run test:unit           # vitest in watch mode
npx vitest run              # single non-watch run (what CI does)
npx vitest run src/stores/__tests__/lists.spec.ts   # one file
npx vitest run -t "some test name"                  # one test by name
```

CI (`.gitea/workflows/pr-checks.yml`) runs `npm run lint` and `npm run test:unit` on PRs to `main`. Pushes to `main` build and rsync `dist/` to production, then fast-forward `dev` to `main`. Day-to-day work happens on `dev`.

Prettier style: no semicolons, single quotes, 100 col. Path alias `@` -> `src`. `VITE_API_BASE_URL` overrides the API base (default `/api/v1`).

`swagger.json` in the repo root (untracked) is the backend's API spec.

## Architecture

Offline-first Vue 3 PWA (Pinia, vue-router, Dexie/IndexedDB, vite-plugin-pwa) for shared lists, recipes (named collections of list items), and exercises. Backend is a separate Go API.

### Offline-first data flow (the part that spans many files)

`stores/lists.ts` and `stores/recipes.ts` are the core. Both follow the same pattern; read one and the other follows.

- **Dexie (`database/db.ts`) is the local source of truth for the UI.** Stores hold reactive copies of the tables and patch them in place (`upsertList`, `removeLocal*`) rather than reloading from Dexie after each write.
- **Mutations write locally first, then enqueue a sync operation** in the shared `syncQueue` table and call `scheduleSync()` (400ms debounce). `SyncQueueEntry` is a discriminated union keyed on `type`; add a new operation by extending `SyncOperationPayloads` in `db.ts`, which makes every incomplete `processSyncEntry` switch a compile error.
- **Both stores share the one `syncQueue` table but each owns disjoint op types** (`LIST_OP_TYPES` / `RECIPE_OP_TYPES`) and must only read and delete its own entries. Update the relevant list when adding an operation.
- **`sync()` = `runSync()` (drain queue in `createdAt` order, stop at the first failure to preserve ordering) then `pullFromServer()`.** Overlapping calls share one in-flight promise; sync and item pulls are serialized via `enqueueOperation`. Pull never overwrites rows with `pendingSync`.
- **Client-generated temporary IDs**: new lists/recipes/items get a client UUID, later swapped for the server ID by `remapListId` / `remapListItemId` (and the recipe equivalents) once the create syncs. Those remaps also rewrite queued entries and link rows referencing the old ID. `clientId` stays stable across the swap, so use it as the `:key` in `v-for` / `TransitionGroup`.
- **Groups** (`stores/groups.ts`) own lists and recipes (`group_id`); every member sees everything in a group. Unlike lists/recipes, groups are **online-only**: Dexie's `groups` table is just a cache of `GET /groups` for offline filtering, and create/rename/share/join/leave/delete/set-default plus moving a list/recipe between groups hit the API directly (no queue ops, no temp IDs). Creates without a `group_id` land in the default group. A recipe may only link items from lists in its own group; the server drops crossing links on a move and `removeLinksAcrossGroups()` mirrors that locally. Only owners may delete a group and owners may not leave; the frontend enforces this itself (`myRole`, from the `role` that `GET /groups` reports) ahead of the backend.
- **Recipe membership** is a link table (`recipeItems`, `[recipeId+listItemId]`), not copies. Item data lives in `listItems`. Deleting a list item also removes it from all recipes (stores call each other).
- **Ordering**: `orderLists` / `orderRecipes` send the full ID list and the server rejects stale sets. `utils/orderRebase.ts` rebuilds a queued reorder against current server state; failed reorders are retried a few times (`MAX_ORDER_ATTEMPTS`), then the server order wins. `composables/useDragReorder.ts` is a Pointer Events drag-and-drop (deliberately not HTML5 DnD, for touch).
- `main.ts` triggers `sync()` for the groups, lists and recipes stores on startup and on the `online` event.
- **4xx vs retryable errors**: `ApiError` + `isServerRejection()` (`api/http.ts`) distinguish a request the server permanently refused (drop it) from network/5xx/401/408/429 (retry).

### API layer

- `api/http.ts` – base URL, `ApiError`, `extractErrorMessage` (no store/router imports, so it is safe to import anywhere).
- `api/client.ts` – `apiClient` / `fetchWithAuth`: attaches the Bearer token, and on 401 refreshes tokens once (a shared `refreshPromise` dedupes concurrent refreshes) then retries. If that fails it redirects to login and throws `SessionExpiredError`.
- `api/*.ts` (lists, recipes, groups, users, invites, exercises, auth, version) are thin per-resource wrappers that throw `Error` with the server's message.

### Auth and routing

`stores/auth.ts` keeps access/refresh JWTs in `localStorage` and decodes claims client-side (`utils/jwt.ts`). The router guard redirects unauthenticated users to `/login?redirect=...` for routes with `meta.requiresAuth`. An `?invite=` query on any route is redirected to `/register` (registration is invite-only and intentionally not linked in the UI). `/groups/join?code=` is where group share links land.

### UI

Views in `views/`, mostly lazy-loaded (only `ListsView` is eagerly imported). Shared components in `components/`; modals build on `BaseModal` / `ConfirmDeleteModal`. Global styles are design tokens in `assets/base.css` plus shared classes (`.btn`, etc.) in `assets/main.css`.

### Testing

Vitest + jsdom + `@vue/test-utils`, with specs in `__tests__/` folders next to the code. Store tests do not use `fake-indexeddb`; they mock `@/database/db` with hand-rolled in-memory fake tables (see the top of `stores/__tests__/lists.spec.ts`).
