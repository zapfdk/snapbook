import type { RoutePoint } from '../types'
import { segmentControl } from '../lib/geometry'

export function RouteGlyph({
  points,
  className,
  color = 'currentColor',
}: {
  points: RoutePoint[]
  className?: string
  color?: string
}) {
  const width = 30
  const height = 36
  const origin = { x: width / 2, y: height - 8 }
  const scale = 1.65
  const toLocal = (point: { x: number; y: number }) => ({
    x: origin.x + point.x * scale,
    y: origin.y - point.y * scale,
  })

  let previous = { x: 0, y: 0 }
  const parts = [`M ${origin.x} ${origin.y}`]
  for (const point of points) {
    const end = toLocal(point)
    const control = segmentControl(previous, point, point.curve)
    if (control) {
      const controlLocal = toLocal(control)
      parts.push(`Q ${controlLocal.x} ${controlLocal.y} ${end.x} ${end.y}`)
    } else {
      parts.push(`L ${end.x} ${end.y}`)
    }
    previous = point
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <path
        d={parts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={origin.x} cy={origin.y} r="2.5" fill={color} />
    </svg>
  )
}
