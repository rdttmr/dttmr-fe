import { nextTick, ref } from 'vue'
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

  // Dropdowns open downward, which hides the lower items of a menu on a card
  // near the fixed bottom nav (or the viewport edge). Once rendered, measure
  // it and flip it upward (see [data-drop-up] in main.css) when it doesn't
  // fit below but does above.
  async function placeDropdown() {
    const container = containerRef.value
    if (!container) return
    delete container.dataset.dropUp
    await nextTick()
    const dropdown = container.querySelector<HTMLElement>('.submenu-dropdown')
    if (!dropdown) return

    const nav = document.querySelector('.bottom-nav')
    const limit = nav ? nav.getBoundingClientRect().top : window.innerHeight
    const menu = dropdown.getBoundingClientRect()
    const trigger = container.getBoundingClientRect()
    if (menu.bottom > limit && trigger.top - menu.height > 0) {
      container.dataset.dropUp = ''
    }
  }

  function toggle(event: Event) {
    event.preventDefault()
    event.stopPropagation()
    isOpen.value = !isOpen.value
    if (isOpen.value) void placeDropdown()
  }

  useClickOutside(containerRef, close)
  useEscapeKey(() => {
    if (isOpen.value) close()
  })

  return { isOpen, containerRef, toggle, close }
}
