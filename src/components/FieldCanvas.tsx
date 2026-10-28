import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  LOS_FROM_TOP,
  clampPlayerPoint,
  MOTION_DASH,
  OPTION_ROUTE_DASH,
  clampRoutePointForPlayer,
  curveFromOffset,
  fieldRoutePoints,
  isRepeatClick,
  motionShape,
  offsetPoint,
  optionDraftShape,
  optionShape,
  routeOrigin,
  routeShape,
  segmentBowPoint,
  segmentOffset,
  snap,
  toField,
  toSvg,
  withCurve,
} from '../lib/geometry'
import { readableInk } from '../lib/color'
import type { Play, Player, Point, RoutePoint } from '../types'

type Tool = 'move' | 'route' | 'sketch' | 'motion' | 'option'

interface FieldCanvasProps {
  play: Play
  selectedId: string | null
  tool: Tool
  draft: RoutePoint[] | null
  /** Pre-snap motion being drawn, shown dashed like a finished motion. */
  motionDraft?: RoutePoint[] | null
  /** Option branch being drawn, dotted from the route point it leaves. */
  optionDraft?: RoutePoint[] | null
  /** Route point index the option being drawn branches from. */
  optionFrom?: number | null
  onSelect: (id: string | null) => void
  onMovePlayer: (id: string, pos: Point) => void
  onAddDraftPoint: (point: RoutePoint) => void
  onAddMotionPoint?: (point: RoutePoint) => void
  onAddOptionPoint?: (point: RoutePoint) => void
  /** Picks the route point an option branches from. */
  onPickOptionFrom?: (index: number) => void
  onSetRoutePoints: (playerId: string, points: RoutePoint[]) => void
  /** Moves one option's points while its handles are dragged. */
  onSetOptionPoints?: (
    playerId: string,
    optionId: string,
    from: number,
    points: RoutePoint[],
  ) => void
  /** Moves a pre-snap motion while its handles are dragged. */
  onSetMotionPoints?: (playerId: string, points: RoutePoint[]) => void
  /** Drops a route point, with the option branches that follow its index. */
  onRemoveRoutePoint?: (playerId: string, index: number) => void
  onRemoveMotionPoint?: (playerId: string, index: number) => void
  onRemoveOptionPoint?: (playerId: string, optionId: string, index: number) => void
  onSketch: (points: Point[]) => void
  /** Second quick click while drawing a route ends the route. */
  onFinishDraft?: () => void
  /** Keeps the formation markers fixed while editing a standalone route. */
  lockPlayers?: boolean
  /** Shows a handle on each segment for dragging its bow. */
  curveHandles?: boolean
  /** Option being reworked, drawn as its draft instead of twice over. */
  hiddenOptionId?: string | null
}

type DragState =
  | { type: 'player'; playerId: string; offset: Point; pos: Point }
  | { type: 'route'; playerId: string; index: number; points: RoutePoint[] }
  | { type: 'curve'; playerId: string; index: number; points: RoutePoint[] }
  | {
      type: 'option'
      playerId: string
      optionId: string
      from: number
      index: number
      points: RoutePoint[]
    }
  | { type: 'motion'; playerId: string; index: number; points: RoutePoint[] }
  | null

const snapPoint = (point: Point, step = 0.5): Point => ({
  x: Number(snap(point.x, step).toFixed(2)),
  y: Number(snap(point.y, step).toFixed(2)),
})

/** How close a double-click has to land to a bow handle to count as a hit. */
const BOW_HANDLE_RADIUS = 0.6


/** How wide the invisible click target drawn along a route is, in field yards. */
const ROUTE_HIT_WIDTH = 1.1

export function FieldCanvas({
  play,
  selectedId,
  tool,
  draft,
  motionDraft = null,
  optionDraft = null,
  optionFrom = null,
  onSelect,
  onMovePlayer,
  onAddDraftPoint,
  onAddMotionPoint,
  onAddOptionPoint,
  onPickOptionFrom,
  onSetRoutePoints,
  onSetOptionPoints,
  onSetMotionPoints,
  onRemoveRoutePoint,
  onRemoveMotionPoint,
  onRemoveOptionPoint,
  onSketch,
  onFinishDraft,
  lockPlayers = false,
  curveHandles = false,
  hiddenOptionId = null,
}: FieldCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [sketch, setSketch] = useState<Point[] | null>(null)
  const sketchRef = useRef<Point[] | null>(null)
  /** When a path was finished by a double-click, so it only does that. */
  const finishedAt = useRef(0)

  useEffect(() => {
    if (tool === 'sketch') return
    sketchRef.current = null
    setSketch(null)
  }, [tool])

  const selectedPlayer = play.players.find((player) => player.id === selectedId) ?? null

  /** A drawn path is as clickable as the marker it belongs to, in move mode. */
  const selectable = tool === 'move'
  const selectRoute = (event: React.PointerEvent, player: Player) => {
    event.stopPropagation()
    onSelect(player.id)
  }

  /**
   * An invisible click target laid over a drawn path, wide enough to hit with a
   * thumb. Selecting a route, one of its options or a motion all pick out the
   * receiver that runs it, exactly like clicking the marker does.
   */
  const hitPath = (player: Player, d: string, what: string, key: string) => (
    <path
      key={key}
      d={d}
      fill="none"
      stroke="transparent"
      strokeWidth={ROUTE_HIT_WIDTH}
      pointerEvents="stroke"
      style={{ cursor: 'pointer' }}
      onPointerDown={(event) => selectRoute(event, player)}
    >
      <title>
        Select {player.label}&apos;s {what}
      </title>
    </path>
  )

  const displayPlayers = useMemo(() => {
    if (drag?.type === 'player') {
      return play.players.map((player) =>
        player.id === drag.playerId ? { ...player, pos: drag.pos } : player,
      )
    }
    if (drag?.type === 'route' || drag?.type === 'curve') {
      return play.players.map((player) =>
        player.id === drag.playerId && player.route
          ? { ...player, route: { ...player.route, points: drag.points } }
          : player,
      )
    }
    if (drag?.type === 'motion') {
      return play.players.map((player) =>
        player.id === drag.playerId
          ? { ...player, motion: { id: player.motion?.id ?? 'motion', points: drag.points } }
          : player,
      )
    }
    if (drag?.type === 'option') {
      return play.players.map((player) =>
        player.id === drag.playerId && player.route?.options
          ? {
              ...player,
              route: {
                ...player.route,
                options: player.route.options.map((option) =>
                  option.id === drag.optionId ? { ...option, points: drag.points } : option,
                ),
              },
            }
          : player,
      )
    }
    return play.players
  }, [play.players, drag])

  const fieldPoint = (event: { clientX: number; clientY: number }): Point | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return toField({
      x: ((event.clientX - rect.left) / rect.width) * FIELD_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * FIELD_HEIGHT,
    })
  }

  /**
   * A clicked position stored as an offset from the origin it belongs to: a
   * motion is measured from the alignment, a route and its options from
   * wherever the motion leaves the player.
   */
  const relativePoint = (point: Point, origin: Point): RoutePoint =>
    clampRoutePointForPlayer(origin, {
      x: Number((point.x - origin.x).toFixed(2)),
      y: Number((point.y - origin.y).toFixed(2)),
    })

  /** A player's route as drawn: its origin plus the points measured from it. */
  const routeFrame = (player: Player) => {
    const origin = routeOrigin(player)
    return { origin, points: fieldRoutePoints(origin, player.route?.points ?? []) }
  }

  /**
   * True when a click is the second half of a double-click, which finishes the
   * path being drawn. The first half placed the point under the double-click;
   * the second half lands in the same spot, so both halves end up as one point
   * instead of two on top of each other.
   */
  const isFinishingClick = (relative: RoutePoint, last?: RoutePoint | null) =>
    Boolean(onFinishDraft) && isRepeatClick(relative, last)

  /** Ends the path being drawn, and keeps the double-click to just that. */
  const finishFromClick = () => {
    finishedAt.current = Date.now()
    onFinishDraft?.()
  }

  const handleBackgroundDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const point = fieldPoint(event)
    if (!point) return
    if (tool === 'motion' && selectedPlayer && onAddMotionPoint) {
      const relative = relativePoint(point, selectedPlayer.pos)
      if (isFinishingClick(relative, motionDraft?.[motionDraft.length - 1])) {
        finishFromClick()
        return
      }
      onAddMotionPoint(relative)
      return
    }
    if (tool === 'option' && selectedPlayer?.route && onAddOptionPoint) {
      // The branch has to come from a route point, so clicks only extend the
      // option once one has been picked on the field.
      if (optionFrom === null) return
      const relative = relativePoint(point, routeOrigin(selectedPlayer))
      if (isFinishingClick(relative, optionDraft?.[optionDraft.length - 1])) {
        finishFromClick()
        return
      }
      onAddOptionPoint(relative)
      return
    }
    if (tool === 'sketch') {
      try {
        svgRef.current?.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic pointers and older browsers may not support capture.
      }
      sketchRef.current = [point]
      setSketch([point])
      return
    }
    if (tool === 'route' && selectedPlayer) {
      const relative = relativePoint(point, routeOrigin(selectedPlayer))
      if (isFinishingClick(relative, draft?.[draft.length - 1])) {
        finishFromClick()
        return
      }
      onAddDraftPoint(relative)
      return
    }
    onSelect(null)
  }

  const capturePointer = (event: React.PointerEvent) => {
    try {
      svgRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointers and older browsers may not support capture; the
      // drag still works while the pointer stays over the field.
    }
  }

  const beginPlayerDrag = (event: React.PointerEvent, player: Player) => {
    if (lockPlayers || tool !== 'move' || event.button !== 0) return
    event.stopPropagation()
    onSelect(player.id)
    const point = fieldPoint(event)
    if (!point) return
    capturePointer(event)
    setDrag({
      type: 'player',
      playerId: player.id,
      offset: { x: point.x - player.pos.x, y: point.y - player.pos.y },
      pos: player.pos,
    })
  }

  const removeRoutePoint = (player: Player, index: number) => {
    if (onRemoveRoutePoint) {
      onRemoveRoutePoint(player.id, index)
      return
    }
    onSetRoutePoints(
      player.id,
      routeFrame(player).points.filter((_, position) => position !== index),
    )
  }

  const removeMotionPoint = (player: Player, index: number) => {
    const motion = player.motion
    if (!motion) return
    if (onRemoveMotionPoint) {
      onRemoveMotionPoint(player.id, index)
      return
    }
    onSetMotionPoints?.(
      player.id,
      fieldRoutePoints(player.pos, motion.points).filter((_, position) => position !== index),
    )
  }

  const removeOptionPoint = (player: Player, optionId: string, index: number) => {
    const option = player.route?.options?.find((item) => item.id === optionId)
    if (!option) return
    if (onRemoveOptionPoint) {
      onRemoveOptionPoint(player.id, optionId, index)
      return
    }
    onSetOptionPoints?.(
      player.id,
      optionId,
      option.from,
      option.points.filter((_, position) => position !== index),
    )
  }

  const beginHandleDrag = (
    event: React.PointerEvent,
    player: Player,
    index: number,
  ) => {
    if (!player.route || event.button !== 0) return
    event.stopPropagation()
    // Alt+click drops the point instead of picking it up.
    if (event.altKey) {
      removeRoutePoint(player, index)
      return
    }
    capturePointer(event)
    setDrag({ type: 'route', playerId: player.id, index, points: routeFrame(player).points })
  }

  /** Segment ending at `index`, in absolute field coordinates. */
  const segmentOf = (origin: Point, points: RoutePoint[], index: number) => ({
    from: index === 0 ? origin : offsetPoint(origin, points[index - 1]),
    to: offsetPoint(origin, points[index]),
  })

  const beginCurveDrag = (
    event: React.PointerEvent,
    player: Player,
    index: number,
  ) => {
    if (!player.route || event.button !== 0) return
    event.stopPropagation()
    capturePointer(event)
    setDrag({ type: 'curve', playerId: player.id, index, points: routeFrame(player).points })
  }

  const beginMotionDrag = (event: React.PointerEvent, player: Player, index: number) => {
    const motion = player.motion
    if (!motion || event.button !== 0) return
    event.stopPropagation()
    if (event.altKey) {
      removeMotionPoint(player, index)
      return
    }
    capturePointer(event)
    setDrag({
      type: 'motion',
      playerId: player.id,
      index,
      points: fieldRoutePoints(player.pos, motion.points),
    })
  }

  const beginOptionDrag = (
    event: React.PointerEvent,
    player: Player,
    optionId: string,
    from: number,
    index: number,
  ) => {
    if (event.button !== 0) return
    const option = player.route?.options?.find((item) => item.id === optionId)
    if (!option) return
    event.stopPropagation()
    if (event.altKey) {
      removeOptionPoint(player, optionId, index)
      return
    }
    capturePointer(event)
    setDrag({
      type: 'option',
      playerId: player.id,
      optionId,
      from,
      index,
      points: option.points.map((point) => ({ ...point })),
    })
  }

  const straightenSegment = (player: Player, index: number) => {
    if (!player.route) return
    const origin = routeOrigin(player)
    onSetRoutePoints(
      player.id,
      fieldRoutePoints(origin, player.route.points).map((point, position) =>
        position === index ? withCurve(point, 0) : point,
      ),
    )
  }

  /**
   * Double-clicking a bow handle straightens its segment. The handler sits on
   * the field rather than the handle because a drag leaves the pointer captured
   * here, which is where the following double-click is delivered.
   */
  const handleFieldDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!curveHandles || tool !== 'move') return
    // The double-click that finished a route just placed its last point; it is
    // not also a request to straighten whatever bow sits under it.
    if (Date.now() - finishedAt.current < 600) return
    const point = fieldPoint(event)
    const player = displayPlayers.find((item) => item.id === selectedId)
    if (!point || !player?.route) return
    const { origin, points } = routeFrame(player)
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const { from, to } = segmentOf(origin, points, index)
      const bow = segmentBowPoint(from, to, points[index].curve)
      if (Math.hypot(point.x - bow.x, point.y - bow.y) <= BOW_HANDLE_RADIUS) {
        straightenSegment(player, index)
        return
      }
    }
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = fieldPoint(event)
    if (!point) return
    setCursor(point)

    if (tool === 'sketch') {
      const current = sketchRef.current
      if (!current) return
      const last = current[current.length - 1]
      if (Math.hypot(point.x - last.x, point.y - last.y) < 0.12) return
      const next = [...current, point]
      sketchRef.current = next
      setSketch(next)
      return
    }

    if (!drag) return
    if (drag.type === 'player') {
      const next = clampPlayerPoint(
        snapPoint({ x: point.x - drag.offset.x, y: point.y - drag.offset.y }),
      )
      setDrag({ ...drag, pos: next })
      return
    }
    if (drag.type === 'route') {
      const player = play.players.find((item) => item.id === drag.playerId)
      if (!player) return
      const origin = routeOrigin(player)
      const next = clampRoutePointForPlayer(
        origin,
        snapPoint({ x: point.x - origin.x, y: point.y - origin.y }),
      )
      const points = drag.points.map((routePoint, index) =>
        index === drag.index ? { ...routePoint, ...next } : routePoint,
      )
      setDrag({ ...drag, points })
      return
    }
    if (drag.type === 'curve') {
      const player = play.players.find((item) => item.id === drag.playerId)
      if (!player) return
      const { from, to } = segmentOf(routeOrigin(player), drag.points, drag.index)
      const curve = curveFromOffset(segmentOffset(from, to, point))
      const points = drag.points.map((routePoint, index) =>
        index === drag.index ? withCurve(routePoint, curve) : routePoint,
      )
      setDrag({ ...drag, points })
      return
    }
    if (drag.type === 'motion') {
      const player = play.players.find((item) => item.id === drag.playerId)
      if (!player) return
      // A motion is measured from the alignment, so its first point is the
      // shift's start and its last one is where the route begins.
      const next = clampRoutePointForPlayer(
        player.pos,
        snapPoint({ x: point.x - player.pos.x, y: point.y - player.pos.y }),
      )
      const points = drag.points.map((routePoint, index) =>
        index === drag.index ? { ...routePoint, ...next } : routePoint,
      )
      setDrag({ ...drag, points })
      return
    }
    if (drag.type === 'option') {
      const player = play.players.find((item) => item.id === drag.playerId)
      if (!player) return
      const origin = routeOrigin(player)
      const next = clampRoutePointForPlayer(
        origin,
        snapPoint({ x: point.x - origin.x, y: point.y - origin.y }),
      )
      const points = drag.points.map((routePoint, index) =>
        index === drag.index ? { ...routePoint, ...next } : routePoint,
      )
      setDrag({ ...drag, points })
    }
  }

  const finishDrag = () => {
    const stroke = sketchRef.current
    if (stroke && stroke.length > 1) onSketch(stroke)
    sketchRef.current = null
    setSketch(null)
    if (drag?.type === 'player') onMovePlayer(drag.playerId, drag.pos)
    if (drag?.type === 'route' || drag?.type === 'curve') {
      onSetRoutePoints(drag.playerId, drag.points)
    }
    if (drag?.type === 'option') {
      onSetOptionPoints?.(drag.playerId, drag.optionId, drag.from, drag.points)
    }
    if (drag?.type === 'motion') {
      onSetMotionPoints?.(drag.playerId, drag.points)
    }
    setDrag(null)
  }

  /**
   * The selected player as the field currently shows them. While a motion is
   * being drawn the route is measured from the motion's last point, so the
   * whole route moves with the shift rather than waiting for it to be finished.
   */
  const previewPlayer = useMemo(() => {
    if (!selectedPlayer || motionDraft === null) return selectedPlayer
    return { ...selectedPlayer, motion: { id: 'motion-draft', points: motionDraft } }
  }, [selectedPlayer, motionDraft])

  /**
   * The path being drawn. A motion is measured from the player's alignment, so
   * it grows from the marker; a route and its options are measured from the
   * end of the motion.
   */
  const draftShape = useMemo(() => {
    if (!previewPlayer) return null
    if (motionDraft !== null) {
      return motionShape(previewPlayer, { id: 'draft', points: motionDraft })
    }
    if (draft === null) return null
    return routeShape(previewPlayer, { id: 'draft', points: draft })
  }, [previewPlayer, draft, motionDraft])

  const optionPreview = useMemo(() => {
    if (!previewPlayer?.route || optionDraft === null || optionFrom === null) return null
    return optionDraftShape(previewPlayer, previewPlayer.route, optionFrom, optionDraft)
  }, [previewPlayer, optionDraft, optionFrom])

  /** Where the rubber-band line to the cursor starts, or null with no preview. */
  const draftAnchor = useMemo(() => {
    if (!previewPlayer) return null
    if (optionDraft !== null) {
      if (optionFrom === null || !previewPlayer.route) return null
      const origin = routeOrigin(previewPlayer)
      const branch = fieldRoutePoints(origin, previewPlayer.route.points)[optionFrom]
      if (!branch) return null
      const anchor = offsetPoint(origin, branch)
      const last = optionDraft[optionDraft.length - 1]
      return last ? offsetPoint(origin, last) : anchor
    }
    if (motionDraft !== null) {
      const last = motionDraft[motionDraft.length - 1]
      return last ? offsetPoint(previewPlayer.pos, last) : previewPlayer.pos
    }
    if (draft === null) return null
    const origin = routeOrigin(previewPlayer)
    const last = draft[draft.length - 1]
    return last ? offsetPoint(origin, last) : origin
  }, [previewPlayer, draft, motionDraft, optionDraft, optionFrom])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
      className="block h-full w-full touch-none select-none"
      style={{
        cursor: tool === 'route' || tool === 'sketch' || tool === 'motion' ? 'crosshair' : 'default',
      }}
      onPointerDown={handleBackgroundDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onDoubleClick={handleFieldDoubleClick}
      onPointerCancel={() => {
        sketchRef.current = null
        setSketch(null)
        setDrag(null)
      }}
      onPointerLeave={() => setCursor(null)}
      role="application"
      aria-label="Play designer field"
    >
      <defs>
        <radialGradient id="field-glow" cx="50%" cy="16%" r="80%">
          <stop offset="0%" stopColor="#1c4d33" />
          <stop offset="58%" stopColor="#123a26" />
          <stop offset="100%" stopColor="#0c2a1b" />
        </radialGradient>
        <pattern id="field-noise" width="2" height="2" patternUnits="userSpaceOnUse">
          <circle cx="0.5" cy="0.5" r="0.025" fill="#d8ff63" fillOpacity="0.06" />
        </pattern>
        <filter id="dot-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="0.08" stdDeviation="0.1" floodColor="#020604" floodOpacity="0.6" />
        </filter>
      </defs>

      <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="url(#field-glow)" />
      <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="url(#field-noise)" />

      <g>
        {[2.5, 7.5, 12.5, 22.5].map((y) => (
          <line
            key={y}
            x1={0}
            y1={y}
            x2={FIELD_WIDTH}
            y2={y}
            stroke="#4f8a68"
            strokeOpacity={0.32}
            strokeWidth={0.06}
          />
        ))}
        <line
          x1={0}
          y1={LOS_FROM_TOP}
          x2={FIELD_WIDTH}
          y2={LOS_FROM_TOP}
          stroke="#d8ff63"
          strokeOpacity={0.5}
          strokeWidth={0.1}
          strokeDasharray="0.25 0.16"
        />
        <text
          x={0.35}
          y={LOS_FROM_TOP - 0.35}
          fontSize={0.42}
          fill="#d8ff63"
          fillOpacity={0.6}
          fontFamily="JetBrains Mono, monospace"
          letterSpacing="0.08"
        >
          LOS
        </text>
        {[5, 10, 15].map((yards) => (
          <text
            key={yards}
            x={FIELD_WIDTH - 0.35}
            y={LOS_FROM_TOP - yards * 1 + 0.16}
            textAnchor="end"
            fontSize={0.38}
            fill="#9dc2aa"
            fillOpacity={0.4}
            fontFamily="JetBrains Mono, monospace"
          >
            {yards}
          </text>
        ))}
        {Array.from({ length: 25 }, (_, index) => (
          <g key={`hash-${index}`}>
            <line
              x1={0}
              y1={index + 0.5}
              x2={0.28}
              y2={index + 0.5}
              stroke="#9dc2aa"
              strokeOpacity={0.3}
              strokeWidth={0.045}
            />
            <line
              x1={FIELD_WIDTH - 0.28}
              y1={index + 0.5}
              x2={FIELD_WIDTH}
              y2={index + 0.5}
              stroke="#9dc2aa"
              strokeOpacity={0.3}
              strokeWidth={0.045}
            />
          </g>
        ))}
        <g transform={`translate(${FIELD_WIDTH / 2}, ${LOS_FROM_TOP})`}>
          <ellipse rx="0.42" ry="0.26" fill="#8b5e34" stroke="#c89563" strokeWidth="0.035" />
          <line x1="-0.2" y1="0" x2="0.2" y2="0" stroke="#f4e4cc" strokeWidth="0.035" />
        </g>
      </g>

      <g>
        {displayPlayers.map((player) => {
          if (!player.motion?.points.length) return null
          if (player.id === selectedId && motionDraft !== null) return null
          const shape = motionShape(player, player.motion)
          if (!shape) return null
          return (
            <g key={`motion-${player.id}`}>
              <path
                d={shape.d}
                fill="none"
                stroke={player.color}
                strokeWidth={0.2}
                strokeOpacity={0.85}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={MOTION_DASH}
              />
              <polygon points={shape.arrow} fill={player.color} />
              {selectable && hitPath(player, shape.d, 'motion', `hit-motion-${player.id}`)}
            </g>
          )
        })}
      </g>

      <g>
        {displayPlayers.map((player) => {
          if (!player.route) return null
          if (player.id === selectedId && draft !== null) return null
          // A motion being drawn carries this player's route along with it.
          const shaped =
            player.id === selectedId && previewPlayer && motionDraft !== null
              ? { ...player, motion: previewPlayer.motion }
              : player
          const shape = routeShape(shaped, player.route)
          const branches = (player.route.options ?? []).flatMap((option) => {
            // The branch being edited shows as its draft instead of twice over.
            if (option.id === hiddenOptionId) return []
            const branch = optionShape(shaped, player.route!, option)
            return branch ? [branch] : []
          })
          if (!shape && !branches.length) return null
          return (
            <g key={`route-${player.id}`}>
              {shape && (
                <>
                  <path
                    d={shape.d}
                    fill="none"
                    stroke={player.color}
                    strokeWidth={0.28}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polygon points={shape.arrow} fill={player.color} />
                </>
              )}
              {branches.map((branch, index) => (
                <g key={`option-${player.id}-${index}`}>
                  <path
                    d={branch.d}
                    fill="none"
                    stroke={player.color}
                    strokeWidth={0.24}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={OPTION_ROUTE_DASH}
                  />
                  <polygon points={branch.arrow} fill={player.color} />
                </g>
              ))}
              {selectable && shape && hitPath(player, shape.d, 'route', `hit-route-${player.id}`)}
              {selectable &&
                branches.map((branch, index) =>
                  hitPath(player, branch.d, 'option', `hit-option-${player.id}-${index}`),
                )}
            </g>
          )
        })}
      </g>

      {draftShape && (
        <path
          d={draftShape.d}
          fill="none"
          stroke={selectedPlayer?.color ?? '#d8ff63'}
          strokeWidth={draft !== null ? 0.28 : 0.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={draft !== null ? '0.35 0.18' : MOTION_DASH}
        />
      )}

      {optionPreview && (
        <path
          d={optionPreview.d}
          fill="none"
          stroke={selectedPlayer?.color ?? '#d8ff63'}
          strokeWidth={0.24}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={OPTION_ROUTE_DASH}
        />
      )}

      {(tool === 'route' || tool === 'motion' || tool === 'option') && draftAnchor && cursor && (
        <g pointerEvents="none">
          <line
            x1={draftAnchor.x + FIELD_WIDTH / 2}
            y1={LOS_FROM_TOP - draftAnchor.y}
            x2={cursor.x + FIELD_WIDTH / 2}
            y2={LOS_FROM_TOP - cursor.y}
            stroke="#d8ff63"
            strokeOpacity={0.5}
            strokeWidth={0.1}
            strokeDasharray="0.22 0.18"
          />
          <circle
            cx={cursor.x + FIELD_WIDTH / 2}
            cy={LOS_FROM_TOP - cursor.y}
            r={0.16}
            fill="#d8ff63"
            fillOpacity={0.8}
          />
        </g>
      )}

      {sketch && sketch.length > 0 && (
        <g pointerEvents="none">
          <polyline
            points={sketch
              .map((point) => `${point.x + FIELD_WIDTH / 2},${LOS_FROM_TOP - point.y}`)
              .join(' ')}
            fill="none"
            stroke="#d8ff63"
            strokeWidth={0.32}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.3 0.16"
          />
          <circle
            cx={sketch[0].x + FIELD_WIDTH / 2}
            cy={LOS_FROM_TOP - sketch[0].y}
            r={0.2}
            fill="#d8ff63"
            fillOpacity={0.9}
          />
        </g>
      )}

      <g>
        {displayPlayers.map((player) => {
          const x = player.pos.x + FIELD_WIDTH / 2
          const y = LOS_FROM_TOP - player.pos.y
          const isSelected = player.id === selectedId
          const isCenter = player.label.toUpperCase() === 'C'
          const text = player.number !== null ? String(player.number) : player.label
          const fontSize = text.length > 3 ? 0.46 : text.length > 2 ? 0.54 : 0.66
          return (
            <g
              key={player.id}
              onPointerDown={(event) => beginPlayerDrag(event, player)}
              style={{ cursor: lockPlayers ? 'default' : tool === 'move' ? 'grab' : 'crosshair' }}
              pointerEvents={tool === 'move' ? 'auto' : 'none'}
            >
              {isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r={0.86}
                  fill="none"
                  stroke="#d8ff63"
                  strokeWidth={0.07}
                  strokeDasharray="0.2 0.13"
                  opacity={0.9}
                />
              )}
              {isCenter ? (
                <rect
                  x={x - 0.58}
                  y={y - 0.58}
                  width={1.16}
                  height={1.16}
                  rx={0.17}
                  fill={player.color}
                  stroke={isSelected ? '#ffffff' : '#0a100c'}
                  strokeWidth={0.11}
                  filter="url(#dot-shadow)"
                />
              ) : (
                <circle
                  cx={x}
                  cy={y}
                  r={0.58}
                  fill={player.color}
                  stroke={isSelected ? '#ffffff' : '#0a100c'}
                  strokeWidth={0.11}
                  filter="url(#dot-shadow)"
                />
              )}
              <text
                x={x}
                y={y + fontSize * 0.36}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={700}
                fontFamily="Inter, Arial, sans-serif"
                fill={readableInk(player.color)}
                pointerEvents="none"
              >
                {text}
              </text>
            </g>
          )
        })}
      </g>

      {tool === 'option' &&
        (() => {
          const player = displayPlayers.find((item) => item.id === selectedId)
          if (!player?.route) return null
          const { origin, points } = routeFrame(player)
          return points.map((point, index) => {
            const absolute = offsetPoint(origin, point)
            const x = absolute.x + FIELD_WIDTH / 2
            const y = LOS_FROM_TOP - absolute.y
            const picked = index === optionFrom
            return (
              <circle
                key={`branch-${index}`}
                cx={x}
                cy={y}
                r={picked ? 0.3 : 0.23}
                fill={picked ? '#d8ff63' : '#0a100c'}
                stroke="#d8ff63"
                strokeWidth={0.07}
                style={{ cursor: 'pointer' }}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  onPickOptionFrom?.(index)
                }}
              >
                <title>Branch an option from this route point</title>
              </circle>
            )
          })
        })()}

      {tool === 'move' &&
        (() => {
          const player = displayPlayers.find((item) => item.id === selectedId)
          if (!player?.route) return null
          const { origin, points } = routeFrame(player)
          return points.map((point, index) => {
            const absolute = offsetPoint(origin, point)
            const x = absolute.x + FIELD_WIDTH / 2
            const y = LOS_FROM_TOP - absolute.y
            return (
              <circle
                key={`handle-${index}`}
                cx={x}
                cy={y}
                r={0.23}
                fill="#0a100c"
                stroke="#d8ff63"
                strokeWidth={0.07}
                style={{ cursor: 'grab' }}
                onPointerDown={(event) => beginHandleDrag(event, player, index)}
              >
                <title>Drag to move this route point · Alt+click removes it</title>
              </circle>
            )
          })
        })()}

      {onSetMotionPoints &&
        tool === 'move' &&
        (() => {
          const player = displayPlayers.find((item) => item.id === selectedId)
          if (!player?.motion?.points.length) return null
          return fieldRoutePoints(player.pos, player.motion.points).map((point, index) => {
            const absolute = offsetPoint(player.pos, point)
            return (
              <circle
                key={`motion-handle-${index}`}
                cx={absolute.x + FIELD_WIDTH / 2}
                cy={LOS_FROM_TOP - absolute.y}
                r={0.2}
                fill="#0a100c"
                stroke="#d8ff63"
                strokeWidth={0.06}
                strokeDasharray="0.14 0.1"
                style={{ cursor: 'grab' }}
                onPointerDown={(event) => beginMotionDrag(event, player, index)}
              >
                <title>
                  {index === player.motion!.points.length - 1
                    ? 'Drag the last motion point · the route moves with it · Alt+click removes it'
                    : 'Drag to move this motion point · Alt+click removes it'}
                </title>
              </circle>
            )
          })
        })()}

      {onSetOptionPoints &&
        tool === 'move' &&
        (() => {
          const player = displayPlayers.find((item) => item.id === selectedId)
          if (!player?.route?.options?.length) return null
          const { origin } = routeFrame(player)
          return player.route.options.flatMap((option) =>
            option.points.map((point, index) => {
              const absolute = offsetPoint(origin, point)
              return (
                <circle
                  key={`option-handle-${option.id}-${index}`}
                  cx={absolute.x + FIELD_WIDTH / 2}
                  cy={LOS_FROM_TOP - absolute.y}
                  r={0.19}
                  fill="#0a100c"
                  stroke="#d8ff63"
                  strokeWidth={0.06}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(event) =>
                    beginOptionDrag(event, player, option.id, option.from, index)
                  }
                >
                  <title>Drag to move this option point · Alt+click removes it</title>
                </circle>
              )
            }),
          )
        })()}

      {curveHandles &&
        tool === 'move' &&
        (() => {
          const player = displayPlayers.find((item) => item.id === selectedId)
          if (!player?.route?.points.length) return null
          const { origin, points } = routeFrame(player)
          return points.map((point, index) => {
            const { from, to } = segmentOf(origin, points, index)
            const bow = toSvg(segmentBowPoint(from, to, point.curve))
            return (
              <circle
                key={`bow-${index}`}
                cx={bow.x}
                cy={bow.y}
                r={0.2}
                fill="#0a100c"
                stroke="#d8ff63"
                strokeWidth={0.06}
                strokeDasharray={point.curve ? undefined : '0.12 0.1'}
                style={{ cursor: 'grab' }}
                onPointerDown={(event) => beginCurveDrag(event, player, index)}
              >
                <title>
                  {point.curve
                    ? 'Drag to change this bow · double-click to straighten'
                    : 'Drag to bow this segment'}
                </title>
              </circle>
            )
          })
        })()}
    </svg>
  )
}
