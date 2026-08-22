import { onMounted, onUnmounted, type Ref } from 'vue'

type OutsideHandler = (event: MouseEvent) => void

const handlers = new Set<OutsideHandler>()

function dispatch(event: MouseEvent) {
  for (const handler of handlers) {
    handler(event)
  }
}

// Backs every call with a single shared `document` click listener instead of
// one per component instance, so a page rendering many dismissable menus
// (e.g. one per row in a list) doesn't fan out into one global listener per
// row.
export function useClickOutside(target: Ref<HTMLElement | null>, onOutside: () => void): void {
  function handler(event: MouseEvent) {
    if (target.value && !target.value.contains(event.target as Node)) {
      onOutside()
    }
  }

  onMounted(() => {
    handlers.add(handler)
    if (handlers.size === 1) {
      document.addEventListener('click', dispatch)
    }
  })

  onUnmounted(() => {
    handlers.delete(handler)
    if (handlers.size === 0) {
      document.removeEventListener('click', dispatch)
    }
  })
}
