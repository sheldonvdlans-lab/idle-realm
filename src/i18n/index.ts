import { ITEMS } from '../game/config'
import type { ActionDef } from '../game/types'
import { en } from './en'

export const t = en // swap here when a second language arrives

export function itemName(id: string): string {
  const item = ITEMS[id]
  return t.kinds[item.kind](t.mats[item.mat])
}

export function actionName(def: ActionDef): string {
  const made = def.verb === 'smelt' || def.verb === 'forge'
  return `${t.verbs[def.verb]} ${made ? itemName(Object.keys(def.outputs)[0]) : t.mats[def.mat]}`
}
