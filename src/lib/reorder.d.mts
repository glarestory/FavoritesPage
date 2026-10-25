export function moveItemToTarget<T extends { id: string }>(
  list: T[],
  sourceId: string,
  targetId: string,
): T[]
