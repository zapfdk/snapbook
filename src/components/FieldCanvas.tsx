import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  LOS_FROM_TOP,
  clampPlayerPoint,
  clampRoutePoint,
  routeShape,
  snap,
  toField,
} from '../lib/geometry'
import { readableInk } from '../lib/color'
import type { Play, Player, Point, RoutePoint } from '../types'

type Tool = 'move' | 'route' | 'sketch'

interface FieldCanvasProps {
  play: Play
  selectedId: string | null
  tool: Tool
  draft: RoutePoint[] | null
  onSelect: (id: string | null) => void
  onMovePlayer: (id: string, pos: Point) => void
  onAddDraftPoint: (point: RoutePoint) => void
  onSetRoutePoints: (playerId: string, points: RoutePoint[]) => void
  onSketch: (points: Point[]) => void
  /** Keeps the formation markers fixed while editing a standalone route. */
  lockPlayers?: boolean
}

type DragState =
  | { type: 'player'; playerId: string; offset: Point; pos: Point }
  | { type: 'route'; playerId: string; index: number; points: RoutePoint[] }
  | null

const snapPoint = (point: Point, step = 0.5): Point => ({
  x: Number(snap(point.x, step).toFixed(2)),
  y: Number(snap(point.y, step).toFixed(2)),
})

export function FieldCanvas({
  play,
  selectedId,
  tool,
  draft,
  onSelect,
  onMovePlayer,
  onAddDraftPoint,
  onSetRoutePoints,
  onSketch,
  lockPlayers = false,
}: FieldCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [sketch, setSketch] = useState<Point[] | null>(null)
  const sketchRef = useRef<Point[] | null>(null)

  useEffect(() => {
    if (tool === 'sketch') return
    sketchRef.current = null
    setSketch(null)
  }, [tool])

  const selectedPlayer = play.players.find((player) => player.id === selectedId) ?? null

  const displayPlayers = useMemo(() => {
    if (drag?.type === 'player') {
      return play.players.map((player) =>
        player.id === drag.playerId ? { ...player, pos: drag.pos } : player,
      )
    }
    if (drag?.type === 'route') {
      return play.players.map((player) =>
        player.id === drag.playerId && player.route
          ? { ...player, route: { ...player.route, points: drag.points } }
          : player,
      )
    }
    return play.players
  }, [play.players, drag])

  const fieldPoint = (event: React.PointerEvent): Point | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return toField({
      x: ((event.clientX - rect.left) / rect.width) * FIELD_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * FIELD_HEIGHT,
    })
  }

  const handleBackgroundDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const point = fieldPoint(event)
    if (!point) return
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
      const relative = clampRoutePoint({
        x: Number((point.x - selectedPlayer.pos.x).toFixed(2)),
        y: Number((point.y - selectedPlayer.pos.y).toFixed(2)),
      })
      onAddDraftPoint(relative)
      return
    }
    onSelect(null)
  }

  const beginPlayerDrag = (event: React.PointerEvent, player: Player) => {
    if (lockPlayers || tool !== 'move' || event.button !== 0) return
    event.stopPropagation()
    onSelect(player.id)
    const point = fieldPoint(event)
    if (!point) return
    svgRef.current?.setPointerCapture(event.pointerId)
    setDrag({
      type: 'player',
      playerId: player.id,
      offset: { x: point.x - player.pos.x, y: point.y - player.pos.y },
      pos: player.pos,
    })
  }

  const beginHandleDrag = (
    event: React.PointerEvent,
    player: Player,
    index: number,
  ) => {
    if (!player.route || event.button !== 0) return
    event.stopPropagation()
    svgRef.current?.setPointerCapture(event.pointerId)
    setDrag({
      type: 'route',
      playerId: player.id,
      index,
      points: player.route.points.map((point) => ({ ...point })),
    })
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
      const next = clampRoutePoint(
        snapPoint({ x: point.x - player.pos.x, y: point.y - player.pos.y }),
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
    if (drag?.type === 'route') onSetRoutePoints(drag.playerId, drag.points)
    setDrag(null)
  }

  const draftShape = useMemo(() => {
    if (!selectedPlayer || draft === null) return null
    return routeShape(selectedPlayer, { id: 'draft', points: draft })
  }, [selectedPlayer, draft])

  const draftAnchor = useMemo(() => {
    if (!selectedPlayer || draft === null) return null
    if (draft.length) {
      const last = draft[draft.length - 1]
      return {
        x: selectedPlayer.pos.x + last.x,
        y: selectedPlayer.pos.y + last.y,
      }
    }
    return selectedPlayer.pos
  }, [selectedPlayer, draft])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
      className="block h-full w-full touch-none select-none"
      style={{ cursor: tool === 'route' || tool === 'sketch' ? 'crosshair' : 'default' }}
      onPointerDown={handleBackgroundDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
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
          if (!player.route) return null
          if (player.id === selectedId && draft !== null) return null
          const shape = routeShape(player, player.route)
          if (!shape) return null
          return (
            <g key={`route-${player.id}`}>
              <path
                d={shape.d}
                fill="none"
                stroke={player.color}
                strokeWidth={0.28}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polygon points={shape.arrow} fill={player.color} />
            </g>
          )
        })}
      </g>

      {draftShape && (
        <path
          d={draftShape.d}
          fill="none"
          stroke={selectedPlayer?.color ?? '#d8ff63'}
          strokeWidth={0.28}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="0.35 0.18"
        />
      )}

      {tool === 'route' && draftAnchor && cursor && (
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
              pointerEvents={tool === 'route' || tool === 'sketch' ? 'none' : 'auto'}
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

      {tool === 'move' &&
        (() => {
          const player = displayPlayers.find((item) => item.id === selectedId)
          if (!player?.route) return null
          return player.route.points.map((point, index) => {
            const x = player.pos.x + point.x + FIELD_WIDTH / 2
            const y = LOS_FROM_TOP - (player.pos.y + point.y)
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
              />
            )
          })
        })()}
    </svg>
  )
}
