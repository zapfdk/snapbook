import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PLAYBOOK, createBlankPlaybook } from '../data/defaults'
import { cloneRouteLibrary } from '../data/routeLibrary'
import { applyRosterGroupPatch, type RosterGroupPatch } from '../lib/roster'
import { applyFormationUpdate } from '../lib/formations'
import { DEFAULT_ROUTE_TREE_SETTINGS } from '../lib/routeTree'
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

interface PlaybookState {
  playbook: Playbook
  wrist: WristCoachSettings
  routeTree: RouteTreeSettings
  setPlaybookName: (name: string) => void
  setTeamName: (team: string) => void
  createPlaybook: (name: string, team: string) => void
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
  clearPlayerRoute: (playId: string, playerId: string) => void
  addRoute: (route: LibraryRoute) => void
  updateRoute: (routeId: string, patch: Partial<Omit<LibraryRoute, 'id'>>) => void
  deleteRoute: (routeId: string) => void
  addFormation: (formation: Formation) => void
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
  importPlaybook: (playbook: Playbook) => void
  resetPlaybook: () => void
}

const updatePlayIn = (playbook: Playbook, playId: string, updater: (play: Play) => Play): Playbook => ({
  ...playbook,
  plays: playbook.plays.map((play) => (play.id === playId ? updater(play) : play)),
})

export const usePlaybook = create<PlaybookState>()(
  persist(
    (set, get) => ({
      playbook: DEFAULT_PLAYBOOK,
      wrist: defaultWrist,
      routeTree: DEFAULT_ROUTE_TREE_SETTINGS,

      setPlaybookName: (name) =>
        set((state) => ({ playbook: { ...state.playbook, name } })),

      setTeamName: (team) =>
        set((state) => ({ playbook: { ...state.playbook, team } })),

      createPlaybook: (name, team) =>
        set((state) => ({
          playbook: createBlankPlaybook(name, team),
          wrist: { ...state.wrist, selectedPlayIds: [] },
        })),

      createPlay: ({ formationId, name, codeName = '', categoryIds = [] }) => {
        const state = get()
        const formation =
          state.playbook.formations.find((item) => item.id === formationId) ??
          state.playbook.formations[0]
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
          playbook: { ...current.playbook, plays: [play, ...current.playbook.plays] },
          wrist: { ...current.wrist, selectedPlayIds: [...current.wrist.selectedPlayIds, id] },
        }))
        return id
      },

      updatePlay: (playId, patch) =>
        set((state) => ({
          playbook: updatePlayIn(state.playbook, playId, (play) => ({
            ...play,
            ...patch,
            updatedAt: now(),
          })),
        })),

      deletePlay: (playId) =>
        set((state) => ({
          playbook: {
            ...state.playbook,
            plays: state.playbook.plays.filter((play) => play.id !== playId),
          },
          wrist: {
            ...state.wrist,
            selectedPlayIds: state.wrist.selectedPlayIds.filter((id) => id !== playId),
          },
        })),

      duplicatePlay: (playId) => {
        const state = get()
        const source = state.playbook.plays.find((play) => play.id === playId)
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
        const index = state.playbook.plays.findIndex((play) => play.id === playId)
        const plays = [...state.playbook.plays]
        plays.splice(index + 1, 0, copy)
        set({
          playbook: { ...state.playbook, plays },
          wrist: { ...state.wrist, selectedPlayIds: [...state.wrist.selectedPlayIds, id] },
        })
        return id
      },

      updatePlayer: (playId, playerId, patch) =>
        set((state) => ({
          playbook: updatePlayIn(state.playbook, playId, (play) => ({
            ...play,
            players: play.players.map((player) =>
              player.id === playerId ? { ...player, ...patch, pos: patch.pos ?? player.pos } : player,
            ),
            updatedAt: now(),
          })),
        })),

      updateRosterGroup: (role, patch) =>
        set((state) => ({
          playbook: applyRosterGroupPatch(state.playbook, role, patch),
        })),

      movePlayer: (playId, playerId, pos) =>
        set((state) => ({
          playbook: updatePlayIn(state.playbook, playId, (play) => ({
            ...play,
            players: play.players.map((player) =>
              player.id === playerId ? { ...player, pos } : player,
            ),
            updatedAt: now(),
          })),
        })),

      applyRoutePreset: (playId, playerId, presetId) =>
        set((state) => ({
          playbook: updatePlayIn(state.playbook, playId, (play) => ({
            ...play,
            players: play.players.map((player) => {
              if (player.id !== playerId) return player
              const route = routeFromPreset(state.playbook.routes, presetId, player)
              return { ...player, route }
            }),
            updatedAt: now(),
          })),
        })),

      setPlayerRoute: (playId, playerId, points) =>
        set((state) => ({
          playbook: updatePlayIn(state.playbook, playId, (play) => ({
            ...play,
            players: play.players.map((player) =>
              player.id === playerId
                ? {
                    ...player,
                    route: points.length ? { id: player.route?.id ?? createId(), points } : null,
                  }
                : player,
            ),
            updatedAt: now(),
          })),
        })),

      clearPlayerRoute: (playId, playerId) =>
        set((state) => ({
          playbook: updatePlayIn(state.playbook, playId, (play) => ({
            ...play,
            players: play.players.map((player) =>
              player.id === playerId ? { ...player, route: null } : player,
            ),
            updatedAt: now(),
          })),
        })),

      addRoute: (route) =>
        set((state) => ({
          playbook: {
            ...state.playbook,
            routes: [...state.playbook.routes, route],
          },
        })),

      updateRoute: (routeId, patch) =>
        set((state) => ({
          playbook: {
            ...state.playbook,
            routes: state.playbook.routes.map((route) =>
              route.id === routeId ? { ...route, ...patch, id: route.id } : route,
            ),
          },
        })),

      deleteRoute: (routeId) =>
        set((state) => ({
          playbook: {
            ...state.playbook,
            routes: state.playbook.routes.filter((route) => route.id !== routeId),
          },
        })),

      addFormation: (formation) =>
        set((state) => ({
          playbook: {
            ...state.playbook,
            formations: [
              ...state.playbook.formations,
              {
                ...formation,
                players: formation.players.map((player) => ({
                  ...player,
                  route: null,
                  pos: { ...player.pos },
                })),
              },
            ],
          },
        })),

      updateFormation: (formationId, patch) =>
        set((state) => ({
          playbook: applyFormationUpdate(state.playbook, formationId, patch),
        })),

      createFormationFromPlay: (playId, name) => {
        const state = get()
        const play = state.playbook.plays.find((item) => item.id === playId)
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
          playbook: {
            ...state.playbook,
            formations: [...state.playbook.formations, formation],
          },
        })
      },

      deleteFormation: (formationId) => {
        const state = get()
        if (state.playbook.formations.length <= 1) return false
        if (state.playbook.plays.some((play) => play.formationId === formationId)) {
          return false
        }
        set({
          playbook: {
            ...state.playbook,
            formations: state.playbook.formations.filter(
              (formation) => formation.id !== formationId,
            ),
          },
        })
        return true
      },

      addCategory: (name) => {
        const trimmed = name.trim()
        const state = get()
        const existing = state.playbook.categories.find(
          (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
        )
        if (existing) return existing.id
        const id = createId()
        const palette = ['#F4C95D', '#82B7FF', '#64D8C4', '#FF8265', '#B09CFF']
        const category: Category = {
          id,
          name: trimmed,
          color: palette[state.playbook.categories.length % palette.length],
        }
        set({
          playbook: {
            ...state.playbook,
            categories: [...state.playbook.categories, category],
          },
        })
        return id
      },

      deleteCategory: (categoryId) =>
        set((state) => ({
          playbook: {
            ...state.playbook,
            categories: state.playbook.categories.filter(
              (category) => category.id !== categoryId,
            ),
            plays: state.playbook.plays.map((play) => ({
              ...play,
              categories: play.categories.filter((id) => id !== categoryId),
            })),
          },
        })),

      togglePlayCategory: (playId, categoryId) =>
        set((state) => ({
          playbook: updatePlayIn(state.playbook, playId, (play) => ({
            ...play,
            categories: play.categories.includes(categoryId)
              ? play.categories.filter((id) => id !== categoryId)
              : [...play.categories, categoryId],
            updatedAt: now(),
          })),
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

      importPlaybook: (playbook) =>
        set({
          playbook,
          wrist: {
            ...get().wrist,
            selectedPlayIds: playbook.plays.map((play) => play.id),
          },
        }),

      resetPlaybook: () => {
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
        set({
          playbook: {
            ...DEFAULT_PLAYBOOK,
            id: createId(),
            routes: cloneRouteLibrary(DEFAULT_PLAYBOOK.routes),
            plays,
          },
          wrist: {
            ...defaultWrist,
            selectedPlayIds: plays.map((play) => play.id),
          },
        })
      },
    }),
    {
      name: 'snapbook.v1',
      partialize: (state) => ({
        playbook: state.playbook,
        wrist: state.wrist,
        routeTree: state.routeTree,
      }),
      version: 2,
      migrate: (persisted) => {
        const state = persisted as Partial<PlaybookState> | undefined
        if (state?.playbook && !Array.isArray(state.playbook.routes)) {
          return {
            ...state,
            playbook: {
              ...state.playbook,
              routes: cloneRouteLibrary(DEFAULT_PLAYBOOK.routes),
            },
          } as PlaybookState
        }
        return state as PlaybookState
      },
    },
  ),
)
