import { onMounted, onUnmounted } from 'vue'

type EscapeHandler = () => void

const handlers = new Set<EscapeHandler>()

function dispatch(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  for (const handler of handlers) {
    handler()
  }
}

// Backs every call with a single shared `document` keydown listener instead
// of one per component instance.
export function useEscapeKey(onEscape: EscapeHandler): void {
  onMounted(() => {
    handlers.add(onEscape)
    if (handlers.size === 1) {
      document.addEventListener('keydown', dispatch)
    }
  })

  onUnmounted(() => {
    handlers.delete(onEscape)
    if (handlers.size === 0) {
      document.removeEventListener('keydown', dispatch)
    }
  })
}
