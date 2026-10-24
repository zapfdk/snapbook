import { useId, useMemo } from 'react'
import { routeShape, toSvg } from '../lib/geometry'
import type { Player, RoutePoint } from '../types'

interface RoutePreviewProps {
  points: RoutePoint[]
  color: string
  className?: string
  showFieldLines?: boolean
  showReceiver?: boolean
}

const player = (points: RoutePoint[]): Player => ({
  id: 'route-preview',
  role: 'Receiver',
  label: 'WR',
  number: null,
  color: '#F1EEE4',
  pos: { x: 0, y: 0 },
  route: { id: 'route-preview', points },
})

export function RoutePreview({
  points,
  color,
  className,
  showFieldLines = true,
  showReceiver = true,
}: RoutePreviewProps) {
  const shape = useMemo(() => routeShape(player(points), { id: 'route-preview', points }), [points])
  const origin = toSvg({ x: 0, y: 0 })
  const noiseId = `route-preview-noise-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <svg
      viewBox="0 0 25 20"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id={noiseId} width="2" height="2" patternUnits="userSpaceOnUse">
          <circle cx="0.5" cy="0.5" r="0.025" fill="#d8ff63" fillOpacity="0.06" />
        </pattern>
      </defs>
      <rect width="25" height="20" fill="transparent" />
      <rect width="25" height="20" fill={`url(#${noiseId})`} />

      {showFieldLines && (
        <g>
          {[2.5, 7.5, 12.5].map((y) => (
            <line
              key={y}
              x1={0}
              y1={y}
              x2={25}
              y2={y}
              stroke="#4f8a68"
              strokeOpacity={0.3}
              strokeWidth={0.055}
            />
          ))}
          {Array.from({ length: 21 }, (_, index) => (
            <g key={`hash-${index}`}>
              <line
                x1={0}
                y1={index}
                x2={0.22}
                y2={index}
                stroke="#9dc2aa"
                strokeOpacity={0.2}
                strokeWidth={0.04}
              />
              <line
                x1={24.78}
                y1={index}
                x2={25}
                y2={index}
                stroke="#9dc2aa"
                strokeOpacity={0.2}
                strokeWidth={0.04}
              />
            </g>
          ))}
          <line
            x1={0}
            y1={17.5}
            x2={25}
            y2={17.5}
            stroke="#d8ff63"
            strokeOpacity={0.42}
            strokeWidth={0.085}
            strokeDasharray="0.24 0.16"
          />
          <text
            x={0.35}
            y={17.15}
            fontSize={0.4}
            fill="#d8ff63"
            fillOpacity={0.55}
            fontFamily="JetBrains Mono, monospace"
            letterSpacing="0.07"
          >
            LOS
          </text>
        </g>
      )}

      {shape && (
        <g>
          <path
            d={shape.d}
            fill="none"
            stroke={color}
            strokeWidth={0.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon points={shape.arrow} fill={color} />
          {points.slice(0, -1).map((point, index) => {
            const p = toSvg(point)
            return (
              <circle
                key={`break-${index}`}
                cx={p.x}
                cy={p.y}
                r={0.19}
                fill={color}
                stroke="#0b170f"
                strokeWidth={0.05}
              />
            )
          })}
        </g>
      )}

      {showReceiver && (
        <g>
          <circle
            cx={origin.x}
            cy={origin.y}
            r={0.58}
            fill="#F1EEE4"
            stroke="#0A100C"
            strokeWidth={0.11}
          />
          <text
            x={origin.x}
            y={origin.y + 0.21}
            textAnchor="middle"
            fontSize={0.46}
            fontWeight={700}
            fontFamily="Inter, Arial, sans-serif"
            fill="#10150f"
          >
            WR
          </text>
        </g>
      )}
    </svg>
  )
}
