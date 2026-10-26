import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PLAYBOOK, createBlankPlaybook } from '../data/defaults'
import { cloneLibraryRoute, cloneRouteLibrary } from '../data/routeLibrary'
import { applyRosterGroupPatch, type RosterGroupPatch } from '../lib/roster'
import { applyFormationUpdate, cloneFormation } from '../lib/formations'
import { clonePlaybook, uniquePlaybookName } from '../lib/library'
import { DEFAULT_ROUTE_TREE_SETTINGS } from '../lib/routeTree'
import { flipRoutePoints } from '../lib/geometry'
import {
  type Category,
  type Formation,
  type LibraryRoute,
  type Play,
  type Playbook,
  type Player,
  type Point,
  type RoutePoint,
  type RouteTreeSettings,
  type WristCoachSettings,
  createId,
} from '../types'

const now = () => new Date().toISOString()

const clonePlayersFromFormation = (formation: Formation): Player[] =>
  formation.players.map((player) => ({
    ...player,
    id: createId(),
    pos: { ...player.pos },
    route: null,
  }))

const sideSign = (player: Player) => (player.pos.x > 0 ? -1 : 1)

const routeFromPreset = (routes: LibraryRoute[], presetId: string, player: Player) => {
  const preset = routes.find((item) => item.id === presetId)
  if (!preset) return null
  const sign = sideSign(player)
  return {
    id: createId(),
    points: preset.points.map((point) => ({
      x: Number((point.x * sign).toFixed(2)),
      y: point.y,
      ...(point.curve ? { curve: point.curve } : {}),
    })),
  }
}

const defaultWrist: WristCoachSettings = {
  selectedPlayIds: DEFAULT_PLAYBOOK.plays.map((play) => play.id),
  columns: 3,
  rows: 3,
  pageWidth: 100,
  pageHeight: 150,
  marginTop: 6,
  marginBottom: 6,
  marginLeft: 6,
  marginRight: 6,
  showCodeName: true,
  showCardNumber: true,
  showCutLines: false,
  showFieldLines: true,
  showPlayerLabels: true,
  playerLabelMode: 'label',
  inkColor: '#111111',
  monochrome: false,
}

export interface PlaybookState {
  playbooks: Playbook[]
  activeId: string
  wrist: WristCoachSettings
  routeTree: RouteTreeSettings
  selectPlaybook: (id: string) => void
  createPlaybook: (name: string, team: string) => string
  duplicatePlaybook: (id?: string) => string | null
  deletePlaybook: (id?: string) => void
  addPlaybook: (playbook: Playbook) => string
  replaceActivePlaybook: (playbook: Playbook) => void
  replaceLibrary: (playbooks: Playbook[], activeId?: string) => void
  setPlaybookName: (name: string) => void
  setTeamName: (team: string) => void
  createPlay: (opts: {
    formationId: string
    name: string
    codeName?: string
    categoryIds?: string[]
  }) => string
  updatePlay: (playId: string, patch: Partial<Omit<Play, 'id' | 'players'>>) => void
  deletePlay: (playId: string) => void
  duplicatePlay: (playId: string) => string | null
  updatePlayer: (playId: string, playerId: string, patch: Partial<Player>) => void
  updateRosterGroup: (role: string, patch: RosterGroupPatch) => void
  movePlayer: (playId: string, playerId: string, pos: Point) => void
  applyRoutePreset: (playId: string, playerId: string, presetId: string) => void
  setPlayerRoute: (playId: string, playerId: string, points: RoutePoint[]) => void
  flipPlayerRoute: (playId: string, playerId: string) => void
  clearPlayerRoute: (playId: string, playerId: string) => void
  addRoute: (route: LibraryRoute) => void
  duplicateRoute: (routeId: string) => LibraryRoute | null
  updateRoute: (routeId: string, patch: Partial<Omit<LibraryRoute, 'id'>>) => void
  deleteRoute: (routeId: string) => void
  addFormation: (formation: Formation) => void
  duplicateFormation: (formationId: string) => Formation | null
  updateFormation: (formationId: string, patch: { name?: string; players?: Player[] }) => void
  createFormationFromPlay: (playId: string, name: string) => void
  deleteFormation: (formationId: string) => boolean
  addCategory: (name: string) => string
  deleteCategory: (categoryId: string) => void
  togglePlayCategory: (playId: string, categoryId: string) => void
  updateWrist: (patch: Partial<WristCoachSettings>) => void
  updateRouteTree: (patch: Partial<RouteTreeSettings>) => void
  toggleWristPlay: (playId: string) => void
  setWristPlays: (playIds: string[]) => void
  moveWristPlay: (playId: string, direction: -1 | 1) => void
  resetPlaybook: () => void
}

type LibraryState = Pick<PlaybookState, 'playbooks' | 'activeId'>

/** The playbook open in the editor. The library always has at least one. */
export function activePlaybook(state: LibraryState): Playbook {
  return state.playbooks.find((playbook) => playbook.id === state.activeId) ?? state.playbooks[0]
}

export const selectActivePlaybook = (state: PlaybookState): Playbook => activePlaybook(state)

/**
 * Keeps a wrist-coach selection usable after switching playbooks: play ids
 * only exist in their own playbook, so anything that no longer resolves is
 * dropped, and an empty result starts from every play.
 */
function wristSelection(playbook: Playbook, selected: string[]): string[] {
  const ids = new Set(playbook.plays.map((play) => play.id))
  const kept = selected.filter((id) => ids.has(id))
  return kept.length ? kept : playbook.plays.map((play) => play.id)
}

const updatePlayIn = (playbook: Playbook, playId: string, updater: (play: Play) => Play): Playbook => ({
  ...playbook,
  plays: playbook.plays.map((play) => (play.id === playId ? updater(play) : play)),
})

/**
 * Reads whatever an older build left in localStorage. Versions before the
 * library stored a single playbook, which becomes the first library entry so
 * the open playbook survives the upgrade.
 */
export function migrateStoredState(
  persisted: unknown,
): Partial<PlaybookState> {
  const state = persisted as
    | (Partial<PlaybookState> & { playbook?: Playbook })
    | undefined

  if (Array.isArray(state?.playbooks) && state.playbooks.length) {
    const activeId =
      typeof state.activeId === 'string' &&
      state.playbooks.some((playbook) => playbook.id === state.activeId)
        ? state.activeId
        : state.playbooks[0].id
    return { ...state, activeId }
  }

  if (state?.playbook) {
    const stored = state.playbook
    const playbook: Playbook = Array.isArray(stored.routes)
      ? stored
      : { ...stored, routes: cloneRouteLibrary(DEFAULT_PLAYBOOK.routes) }
    return {
      playbooks: [playbook],
      activeId: playbook.id,
      wrist: {
        ...(state.wrist ?? defaultWrist),
        selectedPlayIds: wristSelection(playbook, state.wrist?.selectedPlayIds ?? []),
      },
      routeTree: state.routeTree ?? DEFAULT_ROUTE_TREE_SETTINGS,
    }
  }

  return state ?? {}
}

export const usePlaybook = create<PlaybookState>()(
  persist(
    (set, get) => {
      const patchActive = (
        state: PlaybookState,
        update: (playbook: Playbook) => Playbook,
      ): Playbook[] => {
        const playbook = update(activePlaybook(state))
        return state.playbooks.map((item) => (item.id === playbook.id ? playbook : item))
      }

      return {
        playbooks: [DEFAULT_PLAYBOOK],
        activeId: DEFAULT_PLAYBOOK.id,
        wrist: defaultWrist,
        routeTree: DEFAULT_ROUTE_TREE_SETTINGS,

        selectPlaybook: (id) => {
          const state = get()
          const target = state.playbooks.find((playbook) => playbook.id === id)
          if (!target || target.id === state.activeId) return
          set({
            activeId: target.id,
            wrist: {
              ...state.wrist,
              selectedPlayIds: wristSelection(target, state.wrist.selectedPlayIds),
            },
          })
        },

        createPlaybook: (name, team) => {
          const playbook = createBlankPlaybook(name, team)
          set((state) => ({
            playbooks: [...state.playbooks, playbook],
            activeId: playbook.id,
            wrist: { ...state.wrist, selectedPlayIds: playbook.plays.map((play) => play.id) },
          }))
          return playbook.id
        },

        duplicatePlaybook: (id) => {
          const state = get()
          const source = id
            ? state.playbooks.find((playbook) => playbook.id === id)
            : activePlaybook(state)
          if (!source) return null
          const copy = clonePlaybook(
            source,
            uniquePlaybookName(
              `${source.name} copy`,
              state.playbooks.map((playbook) => playbook.name),
            ),
          )
          const index = state.playbooks.findIndex((playbook) => playbook.id === source.id)
          const playbooks = [...state.playbooks]
          playbooks.splice(index + 1, 0, copy)
          set({
            playbooks,
            activeId: copy.id,
            wrist: { ...state.wrist, selectedPlayIds: copy.plays.map((play) => play.id) },
          })
          return copy.id
        },

        deletePlaybook: (id) => {
          const state = get()
          if (state.playbooks.length <= 1) return
          const targetId = id ?? state.activeId
          const playbooks = state.playbooks.filter((playbook) => playbook.id !== targetId)
          if (playbooks.length === state.playbooks.length) return
          const activeId = playbooks.some((playbook) => playbook.id === state.activeId)
            ? state.activeId
            : playbooks[0].id
          const active = playbooks.find((playbook) => playbook.id === activeId) ?? playbooks[0]
          set({
            playbooks,
            activeId,
            wrist: {
              ...state.wrist,
              selectedPlayIds: wristSelection(active, state.wrist.selectedPlayIds),
            },
          })
        },

        addPlaybook: (source) => {
          const state = get()
          const copy = clonePlaybook(
            source,
            uniquePlaybookName(
              source.name,
              state.playbooks.map((playbook) => playbook.name),
            ),
          )
          set({
            playbooks: [...state.playbooks, copy],
            activeId: copy.id,
            wrist: { ...state.wrist, selectedPlayIds: copy.plays.map((play) => play.id) },
          })
          return copy.id
        },

        replaceActivePlaybook: (source) => {
          const state = get()
          const active = activePlaybook(state)
          const playbook = { ...source, id: active.id }
          set({
            playbooks: state.playbooks.map((item) =>
              item.id === active.id ? playbook : item,
            ),
            wrist: {
              ...state.wrist,
              selectedPlayIds: wristSelection(playbook, state.wrist.selectedPlayIds),
            },
          })
        },

        replaceLibrary: (playbooks, activeId) => {
          if (!playbooks.length) return
          set((state) => {
            const active =
              playbooks.find((playbook) => playbook.id === activeId) ??
              playbooks.find((playbook) => playbook.id === state.activeId) ??
              playbooks[0]
            return {
              playbooks,
              activeId: active.id,
              wrist: {
                ...state.wrist,
                selectedPlayIds: wristSelection(active, state.wrist.selectedPlayIds),
              },
            }
          })
        },

        setPlaybookName: (name) =>
          set((state) => ({ playbooks: patchActive(state, (pb) => ({ ...pb, name })) })),

        setTeamName: (team) =>
          set((state) => ({ playbooks: patchActive(state, (pb) => ({ ...pb, team })) })),

        createPlay: ({ formationId, name, codeName = '', categoryIds = [] }) => {
          const state = get()
          const playbook = activePlaybook(state)
          const formation =
            playbook.formations.find((item) => item.id === formationId) ??
            playbook.formations[0]
          const id = createId()
          const play: Play = {
            id,
            name: name.trim() || 'Untitled play',
            codeName: codeName.trim().toUpperCase(),
            formationId: formation.id,
            players: clonePlayersFromFormation(formation),
            categories: categoryIds,
            notes: '',
            createdAt: now(),
            updatedAt: now(),
          }
          set((current) => ({
            playbooks: patchActive(current, (pb) => ({ ...pb, plays: [play, ...pb.plays] })),
            wrist: {
              ...current.wrist,
              selectedPlayIds: [...current.wrist.selectedPlayIds, id],
            },
          }))
          return id
        },

        updatePlay: (playId, patch) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) =>
              updatePlayIn(pb, playId, (play) => ({
                ...play,
                ...patch,
                updatedAt: now(),
              })),
            ),
          })),

        deletePlay: (playId) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) => ({
              ...pb,
              plays: pb.plays.filter((play) => play.id !== playId),
            })),
            wrist: {
              ...state.wrist,
              selectedPlayIds: state.wrist.selectedPlayIds.filter((id) => id !== playId),
            },
          })),

        duplicatePlay: (playId) => {
          const state = get()
          const playbook = activePlaybook(state)
          const source = playbook.plays.find((play) => play.id === playId)
          if (!source) return null
          const id = createId()
          const copy: Play = {
            ...source,
            id,
            name: `${source.name} copy`,
            codeName: source.codeName,
            players: source.players.map((player) => ({
              ...player,
              id: createId(),
              pos: { ...player.pos },
              route: player.route
                ? {
                    id: createId(),
                    points: player.route.points.map((point) => ({ ...point })),
                  }
                : null,
            })),
            createdAt: now(),
            updatedAt: now(),
          }
          const index = playbook.plays.findIndex((play) => play.id === playId)
          set({
            playbooks: patchActive(state, (pb) => {
              const plays = [...pb.plays]
              plays.splice(index + 1, 0, copy)
              return { ...pb, plays }
            }),
            wrist: { ...state.wrist, selectedPlayIds: [...state.wrist.selectedPlayIds, id] },
          })
          return id
        },

        updatePlayer: (playId, playerId, patch) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) =>
              updatePlayIn(pb, playId, (play) => ({
                ...play,
                players: play.players.map((player) =>
                  player.id === playerId
                    ? { ...player, ...patch, pos: patch.pos ?? player.pos }
                    : player,
                ),
                updatedAt: now(),
              })),
            ),
          })),

        updateRosterGroup: (role, patch) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) => applyRosterGroupPatch(pb, role, patch)),
          })),

        movePlayer: (playId, playerId, pos) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) =>
              updatePlayIn(pb, playId, (play) => ({
                ...play,
                players: play.players.map((player) =>
                  player.id === playerId ? { ...player, pos } : player,
                ),
                updatedAt: now(),
              })),
            ),
          })),

        applyRoutePreset: (playId, playerId, presetId) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) =>
              updatePlayIn(pb, playId, (play) => ({
                ...play,
                players: play.players.map((player) => {
                  if (player.id !== playerId) return player
                  const route = routeFromPreset(pb.routes, presetId, player)
                  return { ...player, route }
                }),
                updatedAt: now(),
              })),
            ),
          })),

        setPlayerRoute: (playId, playerId, points) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) =>
              updatePlayIn(pb, playId, (play) => ({
                ...play,
                players: play.players.map((player) =>
                  player.id === playerId
                    ? {
                        ...player,
                        route: points.length
                          ? { id: player.route?.id ?? createId(), points }
                          : null,
                      }
                    : player,
                ),
                updatedAt: now(),
              })),
            ),
          })),

        flipPlayerRoute: (playId, playerId) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) =>
              updatePlayIn(pb, playId, (play) => ({
                ...play,
                players: play.players.map((player) =>
                  player.id === playerId && player.route
                    ? {
                        ...player,
                        route: {
                          ...player.route,
                          points: flipRoutePoints(player.route.points),
                        },
                      }
                    : player,
                ),
                updatedAt: now(),
              })),
            ),
          })),

        clearPlayerRoute: (playId, playerId) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) =>
              updatePlayIn(pb, playId, (play) => ({
                ...play,
                players: play.players.map((player) =>
                  player.id === playerId ? { ...player, route: null } : player,
                ),
                updatedAt: now(),
              })),
            ),
          })),

        addRoute: (route) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) => ({
              ...pb,
              routes: [...pb.routes, route],
            })),
          })),

        duplicateRoute: (routeId) => {
          const state = get()
          const playbook = activePlaybook(state)
          const source = playbook.routes.find((route) => route.id === routeId)
          if (!source) return null
          const copy = cloneLibraryRoute(
            source,
            playbook.routes.map((route) => route.name),
          )
          const index = playbook.routes.findIndex((route) => route.id === routeId)
          set({
            playbooks: patchActive(state, (pb) => {
              const routes = [...pb.routes]
              routes.splice(index + 1, 0, copy)
              return { ...pb, routes }
            }),
          })
          return copy
        },

        updateRoute: (routeId, patch) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) => ({
              ...pb,
              routes: pb.routes.map((route) =>
                route.id === routeId ? { ...route, ...patch, id: route.id } : route,
              ),
            })),
          })),

        deleteRoute: (routeId) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) => ({
              ...pb,
              routes: pb.routes.filter((route) => route.id !== routeId),
            })),
          })),

        addFormation: (formation) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) => ({
              ...pb,
              formations: [
                ...pb.formations,
                {
                  ...formation,
                  players: formation.players.map((player) => ({
                    ...player,
                    route: null,
                    pos: { ...player.pos },
                  })),
                },
              ],
            })),
          })),

        duplicateFormation: (formationId) => {
          const state = get()
          const playbook = activePlaybook(state)
          const source = playbook.formations.find(
            (formation) => formation.id === formationId,
          )
          if (!source) return null
          const copy = cloneFormation(
            source,
            playbook.formations.map((formation) => formation.name),
          )
          const index = playbook.formations.findIndex(
            (formation) => formation.id === formationId,
          )
          set({
            playbooks: patchActive(state, (pb) => {
              const formations = [...pb.formations]
              formations.splice(index + 1, 0, copy)
              return { ...pb, formations }
            }),
          })
          return copy
        },

        updateFormation: (formationId, patch) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) => applyFormationUpdate(pb, formationId, patch)),
          })),

        createFormationFromPlay: (playId, name) => {
          const state = get()
          const playbook = activePlaybook(state)
          const play = playbook.plays.find((item) => item.id === playId)
          if (!play) return
          const formation: Formation = {
            id: createId(),
            name: name.trim() || `${play.name} formation`,
            players: play.players.map((player) => ({
              ...player,
              id: createId(),
              route: null,
              pos: { ...player.pos },
            })),
          }
          set({
            playbooks: patchActive(state, (pb) => ({
              ...pb,
              formations: [...pb.formations, formation],
            })),
          })
        },

        deleteFormation: (formationId) => {
          const state = get()
          const playbook = activePlaybook(state)
          if (playbook.formations.length <= 1) return false
          if (playbook.plays.some((play) => play.formationId === formationId)) {
            return false
          }
          set({
            playbooks: patchActive(state, (pb) => ({
              ...pb,
              formations: pb.formations.filter(
                (formation) => formation.id !== formationId,
              ),
            })),
          })
          return true
        },

        addCategory: (name) => {
          const trimmed = name.trim()
          const state = get()
          const playbook = activePlaybook(state)
          const existing = playbook.categories.find(
            (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
          )
          if (existing) return existing.id
          const id = createId()
          const palette = ['#F4C95D', '#82B7FF', '#64D8C4', '#FF8265', '#B09CFF']
          const category: Category = {
            id,
            name: trimmed,
            color: palette[playbook.categories.length % palette.length],
          }
          set({
            playbooks: patchActive(state, (pb) => ({
              ...pb,
              categories: [...pb.categories, category],
            })),
          })
          return id
        },

        deleteCategory: (categoryId) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) => ({
              ...pb,
              categories: pb.categories.filter((category) => category.id !== categoryId),
              plays: pb.plays.map((play) => ({
                ...play,
                categories: play.categories.filter((id) => id !== categoryId),
              })),
            })),
          })),

        togglePlayCategory: (playId, categoryId) =>
          set((state) => ({
            playbooks: patchActive(state, (pb) =>
              updatePlayIn(pb, playId, (play) => ({
                ...play,
                categories: play.categories.includes(categoryId)
                  ? play.categories.filter((id) => id !== categoryId)
                  : [...play.categories, categoryId],
                updatedAt: now(),
              })),
            ),
          })),

        updateWrist: (patch) =>
          set((state) => ({ wrist: { ...state.wrist, ...patch } })),

        updateRouteTree: (patch) =>
          set((state) => ({ routeTree: { ...state.routeTree, ...patch } })),

        toggleWristPlay: (playId) =>
          set((state) => {
            const selected = state.wrist.selectedPlayIds
            return {
              wrist: {
                ...state.wrist,
                selectedPlayIds: selected.includes(playId)
                  ? selected.filter((id) => id !== playId)
                  : [...selected, playId],
              },
            }
          }),

        setWristPlays: (playIds) =>
          set((state) => ({ wrist: { ...state.wrist, selectedPlayIds: playIds } })),

        moveWristPlay: (playId, direction) =>
          set((state) => {
            const selected = [...state.wrist.selectedPlayIds]
            const index = selected.indexOf(playId)
            const next = index + direction
            if (index < 0 || next < 0 || next >= selected.length) return state
            ;[selected[index], selected[next]] = [selected[next], selected[index]]
            return { wrist: { ...state.wrist, selectedPlayIds: selected } }
          }),

        resetPlaybook: () => {
          const state = get()
          const active = activePlaybook(state)
          const plays = DEFAULT_PLAYBOOK.plays.map((play) => ({
            ...play,
            id: createId(),
            players: play.players.map((player) => ({
              ...player,
              id: createId(),
              pos: { ...player.pos },
              route: player.route
                ? {
                    id: createId(),
                    points: player.route.points.map((point) => ({ ...point })),
                  }
                : null,
            })),
          }))
          const playbook: Playbook = {
            ...DEFAULT_PLAYBOOK,
            id: active.id,
            routes: cloneRouteLibrary(DEFAULT_PLAYBOOK.routes),
            plays,
          }
          set({
            playbooks: state.playbooks.map((item) =>
              item.id === active.id ? playbook : item,
            ),
            wrist: {
              ...defaultWrist,
              selectedPlayIds: plays.map((play) => play.id),
            },
          })
        },
      }
    },
    {
      name: 'snapbook.v1',
      partialize: (state) => ({
        playbooks: state.playbooks,
        activeId: state.activeId,
        wrist: state.wrist,
        routeTree: state.routeTree,
      }),
      version: 3,
      migrate: (persisted) => migrateStoredState(persisted) as PlaybookState,
    },
  ),
)
