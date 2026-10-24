import { createId, type Formation, type Playbook, type Player } from '../types'

export const cloneFormationPlayers = (players: Player[]): Player[] =>
  players.map((player) => ({
    ...player,
    id: createId(),
    pos: { ...player.pos },
    route: null,
  }))

export const formationUsage = (playbook: Playbook, formationId: string): number =>
  playbook.plays.filter((play) => play.formationId === formationId).length

export function uniqueFormationName(base: string, names: string[]): string {
  const used = new Set(names.map((name) => name.trim().toLowerCase()))
  const cleaned = base.trim() || 'New formation'
  if (!used.has(cleaned.toLowerCase())) return cleaned
  let suffix = 2
  while (used.has(`${cleaned} ${suffix}`.toLowerCase())) suffix += 1
  return `${cleaned} ${suffix}`
}

/**
 * Renames or realigns a formation and pushes the new alignments into every
 * play built from it. Routes, jersey numbers and marker colors belong to the
 * individual play and are left untouched.
 */
export function applyFormationUpdate(
  playbook: Playbook,
  formationId: string,
  patch: { name?: string; players?: Player[] },
  updatedAt = new Date().toISOString(),
): Playbook {
  const existing = playbook.formations.find((formation) => formation.id === formationId)
  if (!existing) return playbook

  const nextPlayers = patch.players?.map((player) => ({
    ...player,
    id: player.id,
    pos: { ...player.pos },
    route: null,
  }))
  const nextFormation: Formation = {
    ...existing,
    ...(patch.name === undefined ? {} : { name: patch.name.trim() || existing.name }),
    ...(nextPlayers ? { players: nextPlayers } : {}),
  }
  if (
    nextFormation.name === existing.name &&
    (!nextPlayers || nextPlayers.length === existing.players.length && nextPlayers.every((player, index) => {
      const previous = existing.players[index]
      return (
        player.label === previous.label &&
        player.role === previous.role &&
        player.pos.x === previous.pos.x &&
        player.pos.y === previous.pos.y
      )
    }))
  ) {
    return playbook
  }

  const formations = playbook.formations.map((formation) =>
    formation.id === formationId ? nextFormation : formation,
  )
  if (!nextPlayers) return { ...playbook, formations }

  const plays = playbook.plays.map((play) => {
    if (play.formationId !== formationId) return play
    return {
      ...play,
      players: play.players.map((player, index) => {
        const source = nextPlayers[index]
        if (!source) return player
        return {
          ...player,
          label: source.label,
          role: source.role,
          pos: { ...source.pos },
        }
      }),
      updatedAt,
    }
  })

  return { ...playbook, formations, plays }
}
