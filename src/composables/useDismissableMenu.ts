import { ref } from 'vue'
import { useClickOutside } from '@/composables/useClickOutside'
import { useEscapeKey } from '@/composables/useEscapeKey'

// Bundles the isOpen/containerRef/toggle wiring shared by every dropdown menu
// (list card, list item row, list detail header) so it isn't hand-rolled per
// component on top of useClickOutside/useEscapeKey.
export function useDismissableMenu() {
  const isOpen = ref(false)
  const containerRef = ref<HTMLElement | null>(null)

  function close() {
    isOpen.value = false
  }

  function toggle(event: Event) {
    event.preventDefault()
    event.stopPropagation()
    isOpen.value = !isOpen.value
  }

  useClickOutside(containerRef, close)
  useEscapeKey(() => {
    if (isOpen.value) close()
  })

  return { isOpen, containerRef, toggle, close }
}
