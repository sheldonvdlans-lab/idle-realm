import { MAX_LEVEL, XP_CURVE } from './config'

/** Total xp needed to reach `level`. */
export const xpForLevel = (level: number) =>
  Math.floor(XP_CURVE.cubic * (level - 1) ** 3 + XP_CURVE.linear * (level - 1))

export function levelForXp(xp: number): number {
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++
  return level
}
