import { describe, expect, it } from 'vitest'
import { PBC_VERSION, buildPbcArchive, createPbcFile } from '../exportPbc'
import {
  PbcImportError,
  importPbcFile,
  parsePbcArchive,
  readPbcContainer,
} from '../importPbc'
import { ROUTE_GROUP_COLORS, cloneRouteLibrary } from '../../../data/routeLibrary'
import { category, formation, play, playbook, point } from '../../__tests__/snapbookTestUtils'
import type { Player, Playbook } from '../../../types'
import { buildForeignArchive } from './pbcFixtures'

const receiver = (overrides: Partial<Player> = {}): Player => ({
  id: 'r1',
  role: 'Wide Receiver Left',
  label: 'WR-L',
  number: 11,
  color: '#82B7FF',
  pos: { x: -11, y: 0 },
  route: { id: 'route-1', points: [point(0, 6), point(4, 10, 0.4)] },
  ...overrides,
})

const qb = (overrides: Partial<Player> = {}): Player => ({
  id: 'q1',
  role: 'Quarterback',
  label: 'QB',
  number: 7,
  color: '#FF8265',
  pos: { x: 0, y: -5 },
  route: { id: 'route-2', points: [point(-1, 8), point(2, 12)] },
  ...overrides,
})

/** A playbook covering everything the .pbc export carries. */
function demoPlaybook(): Playbook {
  const spread = formation('Spread Right', [
    {
      id: 'c1',
      role: 'Center',
      label: 'C',
      number: null,
      color: '#F1EEE4',
      pos: { x: 0, y: 0 },
      route: null,
    },
    receiver(),
    qb(),
  ])
  const quick = category('Quick game', '#F4C95D')
  const goalLine = category('Goal line', '#FF8265')
  return playbook({
    name: 'Friday night',
    level: '5v5',
    formations: [spread],
    categories: [quick, goalLine],
    plays: [
      play('Mesh Right', spread.id, [{ ...spread.players[0], route: null }, receiver(), qb()], {
        codeName: 'MESH',
        notes: 'Reads: sit in the window',
        categories: [goalLine.id],
      }),
    ],
  })
}

describe('reading a .pbc file', () => {
  it('round-trips everything the .pbc export carries', async () => {
    const source = demoPlaybook()
    const bytes = await createPbcFile(source, 'game-plan')

    expect(readPbcContainer(bytes).version).toBe(PBC_VERSION)

    const imported = await importPbcFile(bytes, 'game-plan')

    expect(imported.name).toBe('Friday night')
    expect(imported.level).toBe('5v5')
    expect(imported.formations.map((item) => item.name)).toEqual(['Spread Right'])
    expect(imported.plays.map((item) => item.name)).toEqual(['Mesh Right'])
    // Playbook Creator keys its maps by name, so the file stores tags in name
    // order and an import keeps that order.
    expect(imported.categories.map((item) => item.name)).toEqual(['Goal line', 'Quick game'])

    // Nothing keeps a name, an id or a timestamp from the other side.
    expect(imported.id).not.toBe(source.id)
    expect(imported.plays[0].id).not.toBe(source.plays[0].id)
    expect(imported.formations[0].id).not.toBe(source.formations[0].id)
    expect(imported.plays[0].formationId).toBe(imported.formations[0].id)

    const [mesh] = imported.plays
    expect(mesh.codeName).toBe('MESH')
    expect(mesh.notes).toBe('Reads: sit in the window')
    // .pbc stores tags as names only, so an imported tag takes Snapbook's default colour.
    expect(imported.categories[0].color).toBe('#F4C95D')
    // The play still carries the tag it was filed under.
    expect(
      mesh.categories.map(
        (id) => imported.categories.find((imported) => imported.id === id)?.name,
      ),
    ).toEqual(['Goal line'])

    const importedQb = mesh.players.find((player) => player.label === 'QB')!
    expect(importedQb.role).toBe('Quarterback')
    expect(importedQb.number).toBe(7)
    expect(importedQb.color).toBe('#FF8265')
    expect(importedQb.pos).toEqual({ x: 0, y: -5 })
    // A player at x = 0 is mirrored on the way out and back, so the route lines up.
    expect(importedQb.route?.points).toEqual([{ x: -1, y: 8 }, { x: 2, y: 12 }])

    const importedWr = mesh.players.find((player) => player.role === 'Wide Receiver Left')!
    expect(importedWr.route?.points).toEqual([{ x: 0, y: 6 }, { x: 4, y: 10, curve: 0.4 }])
    expect(importedWr.number).toBe(11)

    const centre = mesh.players.find((player) => player.label === 'C')!
    expect(centre.route).toBeNull()
    expect(centre.number).toBeNull()
    expect(centre.color).toBe('#F1EEE4')
    // Playbook Creator labels hold four characters, so a label written as "WR-L"
    // arrives as the export normalised it.
    expect(centre.label).toBe('C')

    // The formation's own players carry the alignment, without a play's routes.
    expect(imported.formations[0].players.map((player) => player.route)).toEqual([null, null, null])
    // Our own export writes an empty route library, so Snapbook's presets are
    // the imported library, unchanged.
    expect(imported.routes.map((route) => route.id)).toEqual(
      cloneRouteLibrary().map((route) => route.id),
    )
  })

  it('reads a file whose bows, motions and route names our export never writes', () => {
    // Playbook Creator itself fills these slots; the shapes below are the ones
    // this reader assumes, so the test pins them down.
    const imported = parsePbcArchive(buildForeignArchive())

    expect(imported.name).toBe('Foreign')
    expect(imported.formations.map((item) => item.name)).toEqual(['Trips Right'])
    expect(imported.plays.map((item) => item.name)).toEqual(['Shift Right'])
    expect(imported.plays[0].codeName).toBe('SHIFT')
    expect(imported.plays[0].formationId).toBe(imported.formations[0].id)
    expect(imported.categories).toEqual([])

    const [left, right] = imported.plays[0].players
    expect(left.role).toBe('Wide Receiver Left')
    expect(left.pos).toEqual({ x: -11, y: 0 })
    expect(left.motion).toBeUndefined()
    // A bow travels as Playbook Creator's bezier control point and comes back.
    // A play's route also carries its own name and wrist code, which Snapbook
    // keeps in its route library instead, so both are dropped.
    expect(left.route?.points).toEqual([{ x: 0, y: 5 }, { x: 0, y: 10, curve: 1.5 }])

    // The file mirrors a player on the right-hand side of the formation.
    expect(right.role).toBe('Wide Receiver Right')
    expect(right.pos).toEqual({ x: 11, y: 0 })
    expect(right.motion?.points).toEqual([{ x: 0, y: 1 }])
    // Playbook Creator measures a route from the end of the motion, the point it
    // also draws that route from, so the file's points are already Snapbook's.
    expect(right.route?.points).toEqual([
      { x: -4, y: 3, curve: 1.5 },
      { x: -4, y: 8 },
    ])

    // The file's routes join Snapbook's presets in the library. Its own names
    // for two of them clash with presets, so they take a suffix.
    const library = new Map(imported.routes.map((route) => [route.name, route]))
    expect(imported.routes).toHaveLength(cloneRouteLibrary().length + 2)
    expect(library.get('Post')?.points).toEqual([
      { x: 0, y: 6 },
      { x: 4, y: 14, curve: 1.8 },
    ])

    const post = library.get('Post (2)')!
    expect(post.points).toEqual([{ x: 0, y: 6 }, { x: 0, y: 14, curve: 1.5 }])
    // A route that ends deep is grouped as one, because .pbc stores no group.
    expect(post.group).toBe('Deep')
    expect(post.color).toBe(ROUTE_GROUP_COLORS.Deep)
    // .pbc keeps a wrist code beside a route and no other text, so it is the note.
    expect(post.note).toBe('PST')

    const slant = library.get('Slant (2)')!
    expect(slant.points).toEqual([{ x: 0, y: 2 }, { x: 4, y: 5 }])
    expect(slant.group).toBe('Quick game')
    expect(slant.color).toBe(ROUTE_GROUP_COLORS['Quick game'])
    expect(slant.note).toBe('SLT')
  })

  it('opens a file that was saved without a password', async () => {
    const bytes = withoutPassword(buildPbcArchive(demoPlaybook()))
    expect(readPbcContainer(bytes).plaintext).not.toBeNull()

    const imported = await importPbcFile(bytes, '')

    expect(imported.name).toBe('Friday night')
    expect(imported.plays.map((play) => play.name)).toEqual(['Mesh Right'])
    expect(imported.formations[0].players).toHaveLength(3)
  })

  it('opens a file that was encrypted with an empty password', async () => {
    const bytes = await createPbcFile(demoPlaybook(), '')
    expect(readPbcContainer(bytes).plaintext).toBeNull()

    const imported = await importPbcFile(bytes, '')

    expect(imported.plays.map((play) => play.name)).toEqual(['Mesh Right'])
  })

  it('says so when an empty password meets a protected file', async () => {
    const bytes = await createPbcFile(demoPlaybook(), 'game-plan')

    await expect(importPbcFile(bytes, '')).rejects.toThrow(/needs a password/i)
  })

  it('refuses a password that does not open the file', async () => {
    const bytes = await createPbcFile(demoPlaybook(), 'game-plan')

    await expect(importPbcFile(bytes, 'almost')).rejects.toThrow(/password/i)
  })

  it('reports a container that holds something other than a playbook', () => {
    const header = new TextEncoder().encode(`${'Playbook-Creator'}\n0.22.0\nnotebook\n`)
    const bytes = new Uint8Array(header.length + 64)
    bytes.set(header, 0)

    expect(() => readPbcContainer(bytes)).toThrow(/holds a notebook file/i)
  })
})

describe('reading a damaged or foreign file', () => {
  const archive = () => buildPbcArchive(demoPlaybook())

  it('reports a truncated container', async () => {
    const bytes = await createPbcFile(demoPlaybook(), 'game-plan')

    await expect(importPbcFile(bytes.subarray(0, 40), 'game-plan')).rejects.toThrow(
      /empty or truncated/i,
    )
  })

  it('does not claim a damaged archive was a wrong password', async () => {
    const bytes = (await createPbcFile(demoPlaybook(), 'game-plan')).slice()
    bytes[bytes.length - 5] ^= 0xff

    // AES-GCM cannot tell the two apart, so the message names both.
    await expect(importPbcFile(bytes, 'game-plan')).rejects.toThrow(/whole file arrived/i)
  })

  it('says so when the file is not a .pbc file', async () => {
    const json = new TextEncoder().encode(JSON.stringify({ format: 'snapbook' }))
    await expect(importPbcFile(json, 'x')).rejects.toThrow(/not a Playbook Creator \.pbc file/i)
    await expect(importPbcFile(new Uint8Array(0), 'x')).rejects.toThrow(PbcImportError)
    await expect(importPbcFile(randomBytes(), 'x')).rejects.toThrow(/not a Playbook Creator/i)
  })

  it('requires a Boost.Serialization archive', () => {
    const mangled = archive().replace('serialization::archive', 'something::else')

    expect(() => parsePbcArchive(mangled)).toThrow(/Boost.Serialization archive/i)
  })

  it('requires the archive version it knows', () => {
    const mangled = archive().replace(/^(\d+ serialization::archive) \d+/, '$1 22')

    expect(() => parsePbcArchive(mangled)).toThrow(/Boost.Serialization 22/i)
  })

  it('refuses trailing data it did not read', () => {
    expect(() => parsePbcArchive(`${archive()} 42`)).toThrow(/more data/i)
  })

  it('reports an archive that stops early instead of inventing a playbook', () => {
    const half = archive().slice(0, Math.floor(archive().length / 2))

    expect(() => parsePbcArchive(half)).toThrow(PbcImportError)
  })

  it('rejects a file whose lengths send the reader off the token it should be on', () => {
    // Four bytes long instead of twelve: the name stops mid-word, so the field
    // size that follows is read from the wrong token. The reader has to notice
    // rather than read whatever it finds as data.
    const mangled = archive().replace('12 Friday night', '4 Friday night')

    expect(() => parsePbcArchive(mangled)).toThrow(PbcImportError)
    expect(() => parsePbcArchive(mangled)).toThrow(/field size/i)
  })
})

/** The container Playbook Creator writes for a file with no password set. */
const withoutPassword = (archive: string): Uint8Array => {
  const header = new TextEncoder().encode(`Playbook-Creator\n${PBC_VERSION}\nplaybook\n`)
  const body = new TextEncoder().encode(archive)
  const bytes = new Uint8Array(header.length + body.length)
  bytes.set(header, 0)
  bytes.set(body, header.length)
  return bytes
}

const randomBytes = (length = 96): Uint8Array => {
  const bytes = new Uint8Array(length)
  for (let index = 0; index < length; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  return bytes
}
