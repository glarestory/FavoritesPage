export interface VisibleTabCountInput {
  tabWidths: readonly number[]
  containerWidth: number
  moreWidth: number
  gap: number
}

export function getVisibleTabCount(input: VisibleTabCountInput): number
