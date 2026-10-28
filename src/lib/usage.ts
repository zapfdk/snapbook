import { sameRoutePoints } from './routeLibraryMerge'
import type { LibraryRoute, Play, Playbook } from '../types'

/**
 * A play names its formation, so the plays built from one are a direct lookup.
 */
export const playsUsingFormation = (playbook: Playbook, formationId: string): Play[] =>
  playbook.plays.filter((play) => play.formationId === formationId)

export interface RouteUsage {
  play: Play
  /** Marker labels of the receivers running this route. */
  labels: string[]
}

/** Every play with at least one receiver running this library route. */
export function playsUsingRoute(playbook: Playbook, route: LibraryRoute): RouteUsage[] {
  const usage: RouteUsage[] = []
  for (const play of playbook.plays) {
    const labels: string[] = []
    for (const player of play.players) {
      if (!player.route || !sameRoutePoints(player.route.points, route.points)) continue
      if (!labels.includes(player.label)) labels.push(player.label)
    }
    if (labels.length) usage.push({ play, labels })
  }
  return usage
}
