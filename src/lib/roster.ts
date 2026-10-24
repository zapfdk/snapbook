import { PALETTE } from '../data/defaults'
import type { Playbook, Player } from '../types'

const DEFAULT_ROLE_COLORS: Record<string, string> = {
  center: PALETTE.center,
  quarterback: PALETTE.quarterback,
  'wide receiver left': PALETTE.receiver1,
  'wide receiver right': PALETTE.receiver2,
  halfback: PALETTE.back,
  'slot receiver': PALETTE.slot,
}

const FALLBACK_COLORS = [
  PALETTE.center,
  PALETTE.quarterback,
  PALETTE.receiver1,
  PALETTE.receiver2,
  PALETTE.back,
  PALETTE.slot,
]

export interface RosterGroupPatch {
  role?: string
  label?: string
  number?: number | null
  color?: string
}

export interface RosterGroup {
  /** Normalized role used to match every formation and play. */
  key: string
  role: string
  label: string
  number: number | null
  color: string
  formationCount: number
  playCount: number
}

export const roleKey = (playerOrRole: Player | string): string => {
  const role =
    typeof playerOrRole === 'string'
      ? playerOrRole
      : playerOrRole.role.trim() || playerOrRole.label
  return role.trim().toLowerCase()
}

export const defaultRosterColor = (role: string, index = 0): string =>
  DEFAULT_ROLE_COLORS[roleKey(role)] ??
  FALLBACK_COLORS[index % FALLBACK_COLORS.length]

interface MutableGroup {
  key: string
  role: string
  label: string
  number: number | null
  color: string
  formationIds: Set<string>
  playIds: Set<string>
}

/**
 * Groups players by role across every formation and play. The role is the
 * meaning that survives alignment changes, so a roster edit can be applied
 * consistently without storing a second roster in the playbook file.
 */
export function getRosterGroups(playbook: Playbook): RosterGroup[] {
  const groups = new Map<string, MutableGroup>()

  const collect = (player: Player, target: 'formation' | 'play', ownerId: string) => {
    const key = roleKey(player)
    if (!key) return
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        role: player.role.trim() || player.label,
        label: player.label,
        number: player.number,
        color: player.color,
        formationIds: new Set(),
        playIds: new Set(),
      }
      groups.set(key, group)
    }
    if (target === 'formation') group.formationIds.add(ownerId)
    else group.playIds.add(ownerId)
  }

  for (const formation of playbook.formations) {
    for (const player of formation.players) collect(player, 'formation', formation.id)
  }
  for (const play of playbook.plays) {
    for (const player of play.players) collect(player, 'play', play.id)
  }

  // Map insertion order follows the first formation/play a role appears in,
  // so renaming a role does not make its card jump around the roster.
  return [...groups.values()].map((group) => ({
      key: group.key,
      role: group.role,
      label: group.label,
      number: group.number,
      color: group.color,
      formationCount: group.formationIds.size,
      playCount: group.playIds.size,
    }))
}

const updatedPlayer = (player: Player, patch: RosterGroupPatch): Player => {
  const nextRole = patch.role?.trim()
  return {
    ...player,
    ...(nextRole ? { role: nextRole } : {}),
    ...(patch.label !== undefined
      ? { label: patch.label.trim().toUpperCase().slice(0, 4) }
      : {}),
    ...(patch.number !== undefined
      ? {
          number:
            patch.number === null
              ? null
              : Math.max(0, Math.min(99, Math.round(patch.number))),
        }
      : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
  }
}

/**
 * Applies one roster change to every matching player while preserving each
 * player's alignment and route. Play timestamps are deliberately untouched so
 * a cosmetic roster edit does not reshuffle the playbook.
 */
export function applyRosterGroupPatch(
  playbook: Playbook,
  role: string,
  patch: RosterGroupPatch,
): Playbook {
  const key = roleKey(role)
  if (!key) return playbook
  if (
    patch.role === undefined &&
    patch.label === undefined &&
    patch.number === undefined &&
    patch.color === undefined
  ) {
    return playbook
  }

  const apply = (player: Player) =>
    roleKey(player) === key ? updatedPlayer(player, patch) : player

  return {
    ...playbook,
    formations: playbook.formations.map((formation) => ({
      ...formation,
      players: formation.players.map(apply),
    })),
    plays: playbook.plays.map((play) => ({
      ...play,
      players: play.players.map(apply),
    })),
  }
}
