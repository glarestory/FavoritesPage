import { useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'

/**
 * Drag-and-drop reordering for a list of rows identified by id.
 * `getRowProps` returns the handlers to spread onto each draggable row.
 */
export function useDragReorder<T extends HTMLElement>(
  onReorder: (sourceId: string, targetId: string) => void,
) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const reset = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const getRowProps = (id: string, enabled: boolean) => ({
    draggable: enabled,
    onDragStart: (event: ReactDragEvent<T>) => {
      if (!enabled) {
        event.preventDefault()
        return
      }
      setDraggedId(id)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', id)
    },
    onDragOver: (event: ReactDragEvent<T>) => {
      if (!draggedId) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (dragOverId !== id) setDragOverId(id)
    },
    onDragLeave: (event: ReactDragEvent<T>) => {
      const related = event.relatedTarget
      if (related instanceof Node && event.currentTarget.contains(related)) return
      setDragOverId((current) => (current === id ? null : current))
    },
    onDrop: (event: ReactDragEvent<T>) => {
      event.preventDefault()
      if (draggedId && draggedId !== id) onReorder(draggedId, id)
      reset()
    },
    onDragEnd: reset,
  })

  return { draggedId, dragOverId, getRowProps }
}
