import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import { getVisibleTabCount } from '../lib/category-overflow.mjs'

function contentWidth(element: HTMLElement) {
  const style = window.getComputedStyle(element)
  return (
    element.clientWidth -
    parseFloat(style.paddingLeft || '0') -
    parseFloat(style.paddingRight || '0')
  )
}

/**
 * Measures hidden copies of every tab (`[data-measure="tab"]`) and the more
 * button variants (`[data-measure="more"]`) inside `measureRef`, and returns
 * how many tabs fit inside `containerRef` on one row.
 */
export function useVisibleTabCount(
  containerRef: RefObject<HTMLElement | null>,
  measureRef: RefObject<HTMLElement | null>,
  tabCount: number,
  layoutKey: string,
) {
  const [visibleCount, setVisibleCount] = useState(tabCount)

  useLayoutEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    const update = () => {
      const tabWidths = Array.from(
        measure.querySelectorAll<HTMLElement>('[data-measure="tab"]'),
        (node) => node.offsetWidth,
      )
      const moreWidth = Math.max(
        0,
        ...Array.from(
          measure.querySelectorAll<HTMLElement>('[data-measure="more"]'),
          (node) => node.offsetWidth,
        ),
      )
      const gap = parseFloat(window.getComputedStyle(measure).columnGap) || 0
      setVisibleCount(
        getVisibleTabCount({
          tabWidths,
          containerWidth: contentWidth(container),
          moreWidth,
          gap,
        }),
      )
    }

    update()
    let active = true
    // Web fonts can change tab widths after the first measurement.
    document.fonts?.ready.then(() => {
      if (active) update()
    })
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [containerRef, measureRef, tabCount, layoutKey])

  return Math.min(visibleCount, tabCount)
}
