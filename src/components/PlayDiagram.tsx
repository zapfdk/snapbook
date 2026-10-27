import { memo } from 'react'
import { readableInk } from '../lib/color'
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  LOS_FROM_TOP,
  MOTION_DASH,
  OPTION_ROUTE_DASH,
  motionShape,
  optionShapes,
  routeShape,
  toSvg,
} from '../lib/geometry'
import type { Player } from '../types'

interface PlayDiagramProps {
  players: Player[]
  className?: string
  fieldLines?: boolean
  showLabels?: boolean
  labelMode?: 'label' | 'number'
  dark?: boolean
  paper?: boolean
  showBorder?: boolean
  strokeScale?: number
  routeColor?: boolean
  ariaLabel?: string
}

export const PlayDiagram = memo(function PlayDiagram({
  players,
  className,
  fieldLines = true,
  showLabels = true,
  labelMode = 'label',
  dark = false,
  paper = false,
  showBorder = false,
  strokeScale = 1,
  routeColor = true,
  ariaLabel,
}: PlayDiagramProps) {
  const ink = paper ? '#171b16' : dark ? '#e8efe6' : '#8aa394'
  const faint = paper ? '#d9d7ca' : dark ? '#32513f' : '#dce7de'
  const fieldFill = paper ? '#fffdf4' : dark ? 'transparent' : '#f7f9f4'

  return (
    <svg
      viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
      className={className}
      role="img"
      aria-label={ariaLabel ?? 'Play diagram'}
    >
      <rect
        x={0}
        y={0}
        width={FIELD_WIDTH}
        height={FIELD_HEIGHT}
        fill={fieldFill}
        rx={paper ? 0 : 0.6}
        stroke={showBorder ? faint : 'none'}
        strokeWidth={showBorder ? 0.08 : 0}
      />
      {fieldLines && (
        <g>
          {[2.5, 7.5, 12.5, 22.5].map((y) => (
            <line
              key={y}
              x1={0}
              y1={y}
              x2={FIELD_WIDTH}
              y2={y}
              stroke={faint}
              strokeWidth={0.07 * strokeScale}
            />
          ))}
          <line
            x1={0}
            y1={LOS_FROM_TOP}
            x2={FIELD_WIDTH}
            y2={LOS_FROM_TOP}
            stroke={ink}
            strokeOpacity={0.65}
            strokeWidth={0.1 * strokeScale}
          />
          {Array.from({ length: 10 }, (_, index) => (
            <line
              key={`hash-${index}`}
              x1={0}
              y1={2.5 + index * 2.5}
              x2={0.35}
              y2={2.5 + index * 2.5}
              stroke={faint}
              strokeWidth={0.06 * strokeScale}
            />
          ))}
          {Array.from({ length: 10 }, (_, index) => (
            <line
              key={`hash-r-${index}`}
              x1={FIELD_WIDTH - 0.35}
              y1={2.5 + index * 2.5}
              x2={FIELD_WIDTH}
              y2={2.5 + index * 2.5}
              stroke={faint}
              strokeWidth={0.06 * strokeScale}
            />
          ))}
        </g>
      )}

      {players.map((player) => {
        if (!player.motion?.points.length) return null
        const shape = motionShape(player, player.motion)
        if (!shape) return null
        const color = routeColor ? player.color : paper ? '#141914' : '#f3f3e8'
        return (
          <g key={`motion-${player.id}`}>
            <path
              d={shape.d}
              fill="none"
              stroke={color}
              strokeWidth={0.2 * strokeScale}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={MOTION_DASH}
            />
            <polygon points={shape.arrow} fill={color} opacity={0.85} />
          </g>
        )
      })}

      {players.map((player) => {
        if (!player.route) return null
        const shape = routeShape(player, player.route)
        const options = optionShapes(player, player.route)
        if (!shape && !options.length) return null
        const color = routeColor ? player.color : paper ? '#141914' : '#f3f3e8'
        return (
          <g key={`route-${player.id}`}>
            {shape && (
              <>
                <path
                  d={shape.d}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.3 * strokeScale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polygon points={shape.arrow} fill={color} />
              </>
            )}
            {options.map((option, index) => (
              <g key={`option-${player.id}-${index}`}>
                <path
                  d={option.d}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.26 * strokeScale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={OPTION_ROUTE_DASH}
                />
                <polygon points={option.arrow} fill={color} opacity={0.9} />
              </g>
            ))}
          </g>
        )
      })}

      {players.map((player) => {
        const point = toSvg(player.pos)
        const isCenter = player.label.toUpperCase() === 'C'
        const radius = 0.58
        const text =
          labelMode === 'number' && player.number !== null
            ? String(player.number)
            : player.label
        const fontSize = text.length > 3 ? 0.48 : text.length > 2 ? 0.55 : 0.66
        return (
          <g key={player.id}>
            {isCenter ? (
              <rect
                x={point.x - radius}
                y={point.y - radius}
                width={radius * 2}
                height={radius * 2}
                rx={0.16}
                fill={player.color}
                stroke={paper ? '#fffdf4' : '#0d120f'}
                strokeWidth={0.12 * strokeScale}
              />
            ) : (
              <circle
                cx={point.x}
                cy={point.y}
                r={radius}
                fill={player.color}
                stroke={paper ? '#fffdf4' : '#0d120f'}
                strokeWidth={0.12 * strokeScale}
              />
            )}
            {showLabels && (
              <text
                x={point.x}
                y={point.y + fontSize * 0.36}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={700}
                fontFamily="Inter, Arial, sans-serif"
                fill={readableInk(player.color)}
                style={{ pointerEvents: 'none' }}
              >
                {text}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
})
