import { describe, expect, it } from 'vitest'
import {
  ROUTE_GROUPS,
  ROUTE_LIBRARY,
  cloneRouteLibrary,
  formatRouteBreak,
  routeBreak,
  routeDepth,
} from '../routeLibrary'

describe('route library', () => {
  it('has a preview, note and group for every preset', () => {
    expect(ROUTE_LIBRARY).toHaveLength(18)
    for (const route of ROUTE_LIBRARY) {
      expect(route.points.length).toBeGreaterThan(0)
      expect(ROUTE_GROUPS).toContain(route.group)
      expect(route.note.length).toBeGreaterThan(20)
      expect(route.color).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('computes route depth and break depth from the preset points', () => {
    const go = ROUTE_LIBRARY.find((route) => route.id === 'go')!
    const post = ROUTE_LIBRARY.find((route) => route.id === 'post')!
    expect(routeDepth(go.points)).toBe(13)
    expect(routeBreak(go.points)).toBeNull()
    expect(routeDepth(post.points)).toBe(14)
    expect(routeBreak(post.points)).toBe(6)
  })

  it('describes break points for vertical, breaking and behind-the-line routes', () => {
    const find = (id: string) => ROUTE_LIBRARY.find((route) => route.id === id)!
    expect(formatRouteBreak(find('go').points)).toBe('Single stem')
    expect(formatRouteBreak(find('post').points)).toBe('Break at 6 yd')
    expect(formatRouteBreak(find('swing').points)).toBe('Release behind LOS')
  })

  it('clones library routes so one playbook cannot mutate another', () => {
    const copy = cloneRouteLibrary()
    expect(copy).toEqual(ROUTE_LIBRARY)
    expect(copy[0]).not.toBe(ROUTE_LIBRARY[0])
    expect(copy[0].points[0]).not.toBe(ROUTE_LIBRARY[0].points[0])

    copy[0].name = 'Edited'
    copy[0].points[0].x = 99
    expect(ROUTE_LIBRARY[0].name).not.toBe('Edited')
    expect(ROUTE_LIBRARY[0].points[0].x).not.toBe(99)
  })
})
