import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTE_LIBRARY } from '../../data/routeLibrary'
import { sameRoutePoints, withPresetRoutes } from '../routeLibraryMerge'
import type { LibraryRoute } from '../../types'

const post: LibraryRoute = DEFAULT_ROUTE_LIBRARY[0]

describe('withPresetRoutes', () => {
  it('fills an empty library with the presets', () => {
    const merged = withPresetRoutes([])

    expect(merged.map((route) => route.name)).toEqual(
      DEFAULT_ROUTE_LIBRARY.map((route) => route.name),
    )
    expect(merged[0]).not.toBe(DEFAULT_ROUTE_LIBRARY[0])
    expect(merged[0].points[0]).not.toBe(DEFAULT_ROUTE_LIBRARY[0].points[0])
  })

  it('keeps a preset the library already draws, in its own name', () => {
    const renamed: LibraryRoute = { ...post, id: 'mine', name: 'Our post' }
    const merged = withPresetRoutes([renamed])

    expect(merged[0].name).toBe('Our post')
    expect(merged).toHaveLength(DEFAULT_ROUTE_LIBRARY.length)
    // The library keeps the name the coach gave it, and no preset is added.
    expect(merged.some((route) => route.id === 'mine')).toBe(true)
    expect(merged.some((route) => route.name === post.name)).toBe(false)
  })

  it('counts a mirrored copy of a preset as the same route', () => {
    const mirrored: LibraryRoute = {
      ...post,
      id: 'mirror',
      name: 'Post right',
      points: post.points.map((point) => ({
        ...point,
        x: -point.x,
        ...(point.curve ? { curve: -point.curve } : {}),
      })),
    }
    const merged = withPresetRoutes([mirrored])

    expect(merged).toHaveLength(DEFAULT_ROUTE_LIBRARY.length)
    expect(merged.some((route) => route.name === post.name)).toBe(false)
  })

  it('gives a preset whose name is taken by another shape a free name', () => {
    const other: LibraryRoute = { ...post, id: 'other', points: [{ x: 0, y: 2 }] }
    const merged = withPresetRoutes([other])

    expect(merged[0].name).toBe(post.name)
    expect(merged.filter((route) => route.name === post.name)).toHaveLength(1)
    expect(merged.some((route) => route.name === `${post.name} 2`)).toBe(true)
    expect(merged).toHaveLength(DEFAULT_ROUTE_LIBRARY.length + 1)
  })
})

describe('sameRoutePoints', () => {
  it('compares shapes, not sides or bow signs', () => {
    const points = [{ x: 3, y: 4 }, { x: 6, y: 9, curve: 0.8 }]

    expect(sameRoutePoints(points, points)).toBe(true)
    expect(sameRoutePoints(points, [{ x: -3, y: 4 }, { x: -6, y: 9, curve: -0.8 }])).toBe(true)
    expect(sameRoutePoints(points, [{ x: 3, y: 4 }, { x: 6, y: 9 }])).toBe(false)
    expect(sameRoutePoints(points, [{ x: 3, y: 5 }])).toBe(false)
    expect(sameRoutePoints([], [])).toBe(false)
  })
})
