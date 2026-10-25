function rowWidth(widths, gap) {
  if (widths.length === 0) return 0
  return widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1)
}

/**
 * Returns how many leading tabs fit in one row. When not all tabs fit, room
 * for the "more" button (plus one gap) is reserved. At least one tab stays
 * visible so the "all" tab is never hidden.
 */
export function getVisibleTabCount({ tabWidths, containerWidth, moreWidth, gap }) {
  if (tabWidths.length === 0) return 0
  if (rowWidth(tabWidths, gap) <= containerWidth) return tabWidths.length

  const available = containerWidth - moreWidth - gap
  let count = 0
  while (
    count < tabWidths.length &&
    rowWidth(tabWidths.slice(0, count + 1), gap) <= available
  ) {
    count += 1
  }
  return Math.max(1, count)
}
