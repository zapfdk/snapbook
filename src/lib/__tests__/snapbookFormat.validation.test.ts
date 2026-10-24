import { describe, expect, it } from 'vitest'
import { parseSnapbook } from '../files'
import { mutateFixture, type JsonObject } from './snapbookTestUtils'

const object = (value: unknown): JsonObject => value as JsonObject
const list = (value: unknown): JsonObject[] => value as JsonObject[]

const firstPlay = (book: JsonObject) => object(list(book.plays)[0])
const firstFormation = (book: JsonObject) => object(list(book.formations)[0])
const firstRoute = (book: JsonObject) => object(list(book.routes)[0])

interface InvalidCase {
  name: string
  build: () => string
  error: RegExp
}

const cases: InvalidCase[] = [
  {
    name: 'invalid JSON text',
    build: () => '{"format": "snapbook",',
    error: /not valid JSON/,
  },
  {
    name: 'an empty string',
    build: () => '   ',
    error: /not valid JSON/,
  },
  {
    name: 'JSON null',
    build: () => 'null',
    error: /file is empty/,
  },
  {
    name: 'an empty array',
    build: () => '[]',
    error: /file is empty/,
  },
  {
    name: 'an empty object',
    build: () => '{}',
    error: /file is empty/,
  },
  {
    name: 'an unsupported format string',
    build: () =>
      mutateFixture((file) => {
        file.format = 'csv'
      }),
    error: /Unsupported Snapbook file format: csv\./,
  },
  {
    name: 'a versioned format alias',
    build: () =>
      mutateFixture((file) => {
        file.format = 'snapbook.v2'
      }),
    error: /Unsupported Snapbook file format: snapbook\.v2\./,
  },
  {
    name: 'a missing version',
    build: () => mutateFixture((file) => delete file.version),
    error: /Unsupported Snapbook file version: missing/,
  },
  {
    name: 'revision 1',
    build: () => mutateFixture((file) => (file.version = 1)),
    error: /Unsupported Snapbook file version: 1\./,
  },
  {
    name: 'revision 0',
    build: () => mutateFixture((file) => (file.version = 0)),
    error: /Unsupported Snapbook file version: 0\./,
  },
  {
    name: 'a negative revision',
    build: () => mutateFixture((file) => (file.version = -3)),
    error: /Unsupported Snapbook file version: -3\./,
  },
  {
    name: 'a fractional revision',
    build: () => mutateFixture((file) => (file.version = 1.5)),
    error: /Unsupported Snapbook file version: 1\.5\./,
  },
  {
    name: 'a textual revision',
    build: () => mutateFixture((file) => (file.version = '3')),
    error: /Unsupported Snapbook file version: 3\./,
  },
  {
    name: 'a textual minimum reader version',
    build: () => mutateFixture((file) => (file.minReaderVersion = '2')),
    error: /Unsupported Snapbook minimum reader version: 2\./,
  },
  {
    name: 'a fractional minimum reader version',
    build: () => mutateFixture((file) => (file.minReaderVersion = 2.5)),
    error: /Unsupported Snapbook minimum reader version: 2\.5\./,
  },
  {
    name: 'a minimum reader newer than the writer',
    build: () =>
      mutateFixture((file) => {
        file.version = 4
        file.minReaderVersion = 5
      }),
    error: /compatibility metadata is inconsistent/,
  },
  {
    name: 'a future minimum reader',
    build: () =>
      mutateFixture((file) => {
        file.version = 4
        file.minReaderVersion = 4
      }),
    error: /needs app version 4 or newer/,
  },
  {
    name: 'a future writer with no minimum reader',
    build: () =>
      mutateFixture((file) => {
        file.version = 4
        delete file.minReaderVersion
      }),
    error: /needs app version 4 or newer/,
  },
  {
    name: 'a missing playbook',
    build: () => mutateFixture((file) => delete file.playbook),
    error: /playbook is missing/,
  },
  {
    name: 'a null playbook',
    build: () => mutateFixture((file) => (file.playbook = null)),
    error: /playbook is missing/,
  },
  {
    name: 'a missing playbook name',
    build: () =>
      mutateFixture((_file, book) => {
        delete book.name
      }),
    error: /playbook name is missing/,
  },
  {
    name: 'a numeric playbook name',
    build: () =>
      mutateFixture((_file, book) => {
        book.name = 7
      }),
    error: /playbook name is missing/,
  },
  {
    name: 'an unsupported field size',
    build: () =>
      mutateFixture((_file, book) => {
        book.level = '9v9'
      }),
    error: /unsupported field size “9v9”/,
  },
  {
    name: 'a non-array tags value',
    build: () =>
      mutateFixture((_file, book) => {
        book.tags = null
      }),
    error: /tags list is malformed/,
  },
  {
    name: 'a non-object tag',
    build: () =>
      mutateFixture((_file, book) => {
        book.tags = ['Quick game']
      }),
    error: /Tag 1 is malformed/,
  },
  {
    name: 'a tag without a name',
    build: () =>
      mutateFixture((_file, book) => {
        list(book.tags)[0] = { color: '#ffffff' }
      }),
    error: /Tag 1 is missing a name/,
  },
  {
    name: 'duplicate tag names in different casing',
    build: () =>
      mutateFixture((_file, book) => {
        list(book.tags)[1].name = 'quick game'
      }),
    error: /two tags named “quick game”/,
  },
  {
    name: 'a non-array route library',
    build: () =>
      mutateFixture((_file, book) => {
        book.routes = {}
      }),
    error: /route library is malformed/,
  },
  {
    name: 'a non-object route',
    build: () =>
      mutateFixture((_file, book) => {
        book.routes = ['Deep Cross']
      }),
    error: /Route 1 is malformed/,
  },
  {
    name: 'a route without a name',
    build: () =>
      mutateFixture((_file, book) => {
        delete firstRoute(book).name
      }),
    error: /Route 1 is missing a name/,
  },
  {
    name: 'a route with a blank name',
    build: () =>
      mutateFixture((_file, book) => {
        firstRoute(book).name = '   '
      }),
    error: /Route 1 is missing a name/,
  },
  {
    name: 'duplicate route names in different casing',
    build: () =>
      mutateFixture((_file, book) => {
        list(book.routes)[1].name = 'DEEP CROSS'
      }),
    error: /two routes named “DEEP CROSS”/,
  },
  {
    name: 'a route without points',
    build: () =>
      mutateFixture((_file, book) => {
        delete firstRoute(book).points
      }),
    error: /Route “Deep Cross” must be a list of route points/,
  },
  {
    name: 'a non-object route point',
    build: () =>
      mutateFixture((_file, book) => {
        firstRoute(book).points = ['x']
      }),
    error: /Route “Deep Cross” point 1 is malformed/,
  },
  {
    name: 'a route point without x',
    build: () =>
      mutateFixture((_file, book) => {
        firstRoute(book).points = [{ y: 4 }]
      }),
    error: /Route “Deep Cross” point 1 is missing x/,
  },
  {
    name: 'a route point without y',
    build: () =>
      mutateFixture((_file, book) => {
        firstRoute(book).points = [{ x: 4, y: 'far' }]
      }),
    error: /Route “Deep Cross” point 1 is missing y/,
  },
  {
    name: 'a route point with a textual curve',
    build: () =>
      mutateFixture((_file, book) => {
        firstRoute(book).points = [{ x: 4, y: 2, curve: 'bend' }]
      }),
    error: /Route “Deep Cross” point 1 has an invalid curve/,
  },
  {
    name: 'a library route with no points',
    build: () =>
      mutateFixture((_file, book) => {
        firstRoute(book).points = []
      }),
    error: /Route “Deep Cross” has no points/,
  },
  {
    name: 'a missing formations list',
    build: () =>
      mutateFixture((_file, book) => {
        delete book.formations
      }),
    error: /has no formations/,
  },
  {
    name: 'a non-array formations list',
    build: () =>
      mutateFixture((_file, book) => {
        book.formations = {}
      }),
    error: /formations list is malformed/,
  },
  {
    name: 'a non-object formation',
    build: () =>
      mutateFixture((_file, book) => {
        book.formations = ['Spread']
      }),
    error: /Formation 1 is malformed/,
  },
  {
    name: 'a formation without a name',
    build: () =>
      mutateFixture((_file, book) => {
        delete firstFormation(book).name
      }),
    error: /Formation 1 is missing a name/,
  },
  {
    name: 'duplicate formation names in different casing',
    build: () =>
      mutateFixture((_file, book) => {
        list(book.formations)[1].name = 'spread right'
      }),
    error: /two formations named “spread right”/,
  },
  {
    name: 'a formation without players',
    build: () =>
      mutateFixture((_file, book) => {
        delete firstFormation(book).players
      }),
    error: /Formation “Spread Right” is missing its players/,
  },
  {
    name: 'a formation with an empty lineup',
    build: () =>
      mutateFixture((_file, book) => {
        firstFormation(book).players = []
      }),
    error: /Formation “Spread Right” has no players/,
  },
  {
    name: 'a non-object formation player',
    build: () =>
      mutateFixture((_file, book) => {
        firstFormation(book).players = ['C']
      }),
    error: /Player 1 in “Spread Right” is malformed/,
  },
  {
    name: 'a formation player without x',
    build: () =>
      mutateFixture((_file, book) => {
        firstFormation(book).players = [{ y: 0 }]
      }),
    error: /Player 1 in “Spread Right” is missing x/,
  },
  {
    name: 'a formation player without y',
    build: () =>
      mutateFixture((_file, book) => {
        firstFormation(book).players = [{ x: 0, y: 'deep' }]
      }),
    error: /Player 1 in “Spread Right” is missing y/,
  },
  {
    name: 'a non-array plays list',
    build: () =>
      mutateFixture((_file, book) => {
        book.plays = {}
      }),
    error: /plays list is malformed/,
  },
  {
    name: 'a non-object play',
    build: () =>
      mutateFixture((_file, book) => {
        book.plays = ['Mesh']
      }),
    error: /Play 1 is malformed/,
  },
  {
    name: 'a play without a name',
    build: () =>
      mutateFixture((_file, book) => {
        delete firstPlay(book).name
      }),
    error: /Play 1 is missing a name/,
  },
  {
    name: 'a play without a formation',
    build: () =>
      mutateFixture((_file, book) => {
        delete firstPlay(book).formation
      }),
    error: /Play “Mesh Right” is missing its formation/,
  },
  {
    name: 'a play using an unknown formation',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).formation = 'Nope'
      }),
    error: /Play “Mesh Right” uses the unknown formation “Nope”/,
  },
  {
    name: 'a non-object lineup',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).lineup = []
      }),
    error: /lineup for “Mesh Right” is malformed/,
  },
  {
    name: 'a lineup changing an unknown player',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).lineup = { Z: { x: 1 } }
      }),
    error: /Play “Mesh Right” changes the unknown player “Z”/,
  },
  {
    name: 'a non-object lineup patch',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).lineup = { C: 'moved' }
      }),
    error: /The change to “C” in “Mesh Right” is malformed/,
  },
  {
    name: 'a numeric lineup label',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).lineup = { C: { label: 9 } }
      }),
    error: /The label for “C” in “Mesh Right” must be text/,
  },
  {
    name: 'a non-text lineup role',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).lineup = { C: { role: true } }
      }),
    error: /The role for “C” in “Mesh Right” must be text/,
  },
  {
    name: 'a textual lineup number',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).lineup = { C: { number: 'seven' } }
      }),
    error: /The number for “C” in “Mesh Right” must be a number/,
  },
  {
    name: 'a non-text lineup color',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).lineup = { C: { color: 0 } }
      }),
    error: /The color for “C” in “Mesh Right” must be text/,
  },
  {
    name: 'a textual lineup x position',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).lineup = { C: { x: 'left' } }
      }),
    error: /The x position for “C” in “Mesh Right” must be a number/,
  },
  {
    name: 'a non-object play routes value',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).routes = []
      }),
    error: /The routes for “Mesh Right” are malformed/,
  },
  {
    name: 'a play route for an unknown player',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).routes = { Z: [{ x: 0, y: 1 }] }
      }),
    error: /Play “Mesh Right” has a route for the unknown player “Z”/,
  },
  {
    name: 'a play route that is not a point list',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).routes = { C: null }
      }),
    error: /The route for “C” in “Mesh Right” must be a list of route points/,
  },
  {
    name: 'a play route point without x',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).routes = { C: [{ y: 2 }] }
      }),
    error: /The route for “C” in “Mesh Right” point 1 is missing x/,
  },
  {
    name: 'a play route point with an invalid curve',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).routes = { C: [{ x: 0, y: 2, curve: null }] }
      }),
    error: /point 1 has an invalid curve/,
  },
  {
    name: 'a non-array play tags value',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).tags = null
      }),
    error: /The tags for “Mesh Right” are malformed/,
  },
  {
    name: 'a non-text play tag',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).tags = [42]
      }),
    error: /A tag on “Mesh Right” must be text/,
  },
  {
    name: 'a play referencing an unknown tag',
    build: () =>
      mutateFixture((_file, book) => {
        firstPlay(book).tags = ['Nope']
      }),
    error: /Play “Mesh Right” uses the unknown tag “Nope”/,
  },
  {
    name: 'a route coordinate that overflows during JSON parsing',
    build: () =>
      mutateFixture(() => undefined).replace(
        '{"x":0,"y":4}',
        '{"x":1e400,"y":4}',
      ),
    error: /Route “Deep Cross” point 1 is missing x/,
  },
  {
    name: 'a modern-looking object with no format marker',
    build: () => JSON.stringify({ version: 3, playbook: {} }),
    error: /does not look like a Snapbook playbook file/,
  },
]

describe('Snapbook import validation', () => {
  it.each(cases)('rejects $name with a useful error', ({ build, error }) => {
    expect(() => parseSnapbook(build())).toThrow(error)
  })

  it('reports invalid JSON separately from an invalid schema', () => {
    expect(() => parseSnapbook('{')).toThrow('That file is not valid JSON.')
    expect(() => parseSnapbook('[]')).toThrow('That file is empty.')
  })

  it('accepts a single-point player route', () => {
    const restored = parseSnapbook(
      mutateFixture((_file, book) => {
        firstPlay(book).routes = { C: [{ x: 0, y: 1 }] }
      }),
    )
    expect(restored.plays[0].players[0].route?.points).toEqual([{ x: 0, y: 1 }])
  })

  it('accepts null jersey numbers in formation players and lineup patches', () => {
    const restored = parseSnapbook(
      mutateFixture((_file, book) => {
        firstFormation(book).players = [
          { label: 'C', role: 'Center', number: null, color: '#fff', x: 0, y: 0 },
        ]
        firstPlay(book).lineup = { C: { number: null } }
        firstPlay(book).routes = {}
      }),
    )
    expect(restored.formations[0].players[0].number).toBeNull()
  })
})
