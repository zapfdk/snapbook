import { BoostTextArchive } from '../boostWriter'

/** std::numeric_limits<double>::min(): Playbook Creator's "no bow" marker. */
export const NO_CONTROL = 2.2250738585072014e-308

interface ForeignPath {
  x: number
  y: number
  control: { x: number; y: number } | null
}

interface ForeignRoute {
  name: string
  code: string
  paths: ForeignPath[]
}

interface ForeignPlayer {
  role: string
  label: string
  rgb: [number, number, number]
  pos: { x: number; y: number }
  route: ForeignRoute | null
  motion: ForeignPath[] | null
  number: number
}

/**
 * An archive in Playbook Creator's own shape, built with the same writer the
 * export uses, covering what this project's own export never writes: a route
 * library, a player's pre-snap motion, a bow on a route, and a second player.
 * Only the structure is spelled out here; the coordinates are picked so that the
 * values the reader should recover are plain numbers.
 *
 * The class layouts are the ones in Playbook Creator's own model headers:
 * PBCRoute is the shared paths plus a name and a wrist code, while PBCMotion is
 * the shared paths plus the position its player ends up at.
 */
export function buildForeignArchive(): string {
  const archive = new BoostTextArchive()

  /** The paths every movement shares. */
  const movementPaths = (list: ForeignPath[]) => {
    archive.object('vector<shared_ptr<PBCPath>>', 0, () => {
      archive.num(list.length)
      archive.num(1)
      for (const path of list) {
        archive.sharedPtr('shared_ptr<PBCPath>', 'PBCPath', 2, path, (value) => {
          archive.float(value.x)
          archive.float(value.y)
          archive.float(value.control?.x ?? NO_CONTROL)
          archive.float(value.control?.y ?? NO_CONTROL)
        })
      }
    })
  }

  const routeBody = (route: ForeignRoute) => {
    archive.object('PBCAbstractMovement', 0, () => movementPaths(route.paths))
    archive.str(route.name)
    archive.str(route.code)
  }

  const motionBody = (motion: ForeignPath[]) => {
    archive.object('PBCAbstractMovement', 0, () => movementPaths(motion))
    // The motion's end point is the last path's end, where the player stands
    // when the shift is over.
    const end = motion[motion.length - 1]
    archive.float(end?.x ?? 0)
    archive.float(end?.y ?? 0)
  }

  const writePlayer = (player: ForeignPlayer) => {
    archive.str(player.role)
    archive.charArray4('array<char,4>', player.label)
    archive.object('PBCColor', 0, () => {
      archive.num(player.rgb[0])
      archive.num(player.rgb[1])
      archive.num(player.rgb[2])
    })
    archive.float(player.pos.x)
    archive.float(player.pos.y)
    archive.sharedPtr('shared_ptr<PBCRoute>', 'PBCRoute', 0, player.route, routeBody)
    archive.sharedPtr('shared_ptr<PBCMotion>', 'PBCMotion', 0, player.motion, motionBody)
    archive.str('')
    archive.num(player.number)
    archive.object('vector<shared_ptr<PBCRoute>>', 0, () => {
      archive.num(0)
      archive.num(1)
    })
    archive.nullPtr('shared_ptr<PBCRoute>')
    archive.nullPtr('shared_ptr<PBCRoute>')
  }

  const players: ForeignPlayer[] = [
    {
      role: 'Wide Receiver Left',
      label: 'WRL',
      rgb: [130, 183, 255],
      pos: { x: -11, y: 0 },
      // Straight up the field, then a stem that bows 1.5 yards to the outside.
      route: {
        name: 'Corner',
        code: 'CRN',
        paths: [
          { x: 0, y: 5, control: null },
          { x: 0, y: 10, control: { x: -1.5, y: 7.5 } },
        ],
      },
      motion: null,
      number: 11,
    },
    {
      role: 'Wide Receiver Right',
      label: 'WRR',
      rgb: [255, 130, 101],
      pos: { x: 11, y: 0 },
      // Mirrored for the right-hand side, and measured from where the motion
      // leaves this player rather than from the alignment behind it.
      route: {
        name: 'Wheel',
        code: 'WHL',
        paths: [
          { x: 4, y: 3, control: { x: 2.9, y: 0.3 } },
          { x: 4, y: 8, control: null },
        ],
      },
      motion: [{ x: 0, y: 1, control: null }],
      number: 88,
    },
  ]

  const formation = { name: 'Trips Right' }
  const play = { name: 'Shift Right' }
  // Playbook Creator opens a new playbook with four standard routes, and its
  // names overlap Snapbook's own: "Post" and "Slant" land on presets, so an
  // import has to give them room.
  const library: ForeignRoute[] = [
    {
      name: 'Post',
      code: 'PST',
      paths: [
        { x: 0, y: 6, control: null },
        { x: 0, y: 14, control: { x: -1.5, y: 10 } },
      ],
    },
    {
      name: 'Slant',
      code: 'SLT',
      paths: [
        { x: 0, y: 2, control: null },
        { x: 4, y: 5, control: null },
      ],
    },
  ]

  archive.str('serialization::archive')
  archive.num(19)
  archive.object('PBCPlaybook', 1, () => {
    archive.str('0.22.0')
    archive.str('Foreign')
    archive.num(5)

    archive.map(
      'map<string,shared_ptr<PBCFormation>>',
      'pair<const string,shared_ptr<PBCFormation>>',
      [['Trips Right', formation]],
      (value) =>
        archive.sharedPtr('shared_ptr<PBCFormation>', 'PBCFormation', 0, value, () => {
          archive.object(
            'PBCCategory',
            0,
            () => {
              archive.str(value.name)
              archive.object('set<shared_ptr<PBCPlay>>', 0, () => {
                archive.num(0)
                archive.num(1)
              })
            },
            { identity: {} },
          )
          archive.sharedPtrCollection(
            'vector<shared_ptr<PBCPlayer>>',
            'shared_ptr<PBCPlayer>',
            'PBCPlayer',
            3,
            players,
            writePlayer,
          )
        }),
    )

    archive.map(
      'map<string,shared_ptr<PBCRoute>>',
      'pair<const string,shared_ptr<PBCRoute>>',
      library.map((route) => [route.name, route] as [string, ForeignRoute]),
      (value) => archive.sharedPtr('shared_ptr<PBCRoute>', 'PBCRoute', 0, value, routeBody),
    )

    archive.map(
      'map<string,shared_ptr<PBCPlay>>',
      'pair<const string,shared_ptr<PBCPlay>>',
      [['Shift Right', play]],
      () =>
        archive.sharedPtr('shared_ptr<PBCPlay>', 'PBCPlay', 1, play, () => {
          archive.str('Shift Right')
          archive.str('SHIFT')
          // The play's alignment is the same object as the formation above, so
          // the archive refers back to it instead of writing it a second time.
          archive.sharedPtr('shared_ptr<PBCFormation>', 'PBCFormation', 0, formation, () => {
            throw new Error('the alignment should have been written already')
          })
          archive.sharedPtrCollection(
            'set<shared_ptr<PBCCategory>>',
            'shared_ptr<PBCCategory>',
            'PBCCategory',
            0,
            [],
            () => undefined,
          )
          archive.str('')
        }),
    )

    archive.map(
      'map<string,shared_ptr<PBCCategory>>',
      'pair<const string,shared_ptr<PBCCategory>>',
      [],
      () => undefined,
    )
  })

  return archive.toString()
}
