import type { TreePageLayout } from '../lib/routeTree'
import { TREE_FIELD_BACK, TREE_FIELD_DEPTH } from '../lib/routeTree'

interface RouteTreePageProps {
  layout: TreePageLayout
  ariaLabel?: string
}

export function RouteTreePage({ layout, ariaLabel }: RouteTreePageProps) {
  const { field } = layout
  const mapY = (yards: number) =>
    field.y + ((TREE_FIELD_DEPTH - (yards - TREE_FIELD_BACK)) / TREE_FIELD_DEPTH) * field.height
  const hashYards = Array.from(
    { length: TREE_FIELD_DEPTH + 1 },
    (_, index) => TREE_FIELD_BACK + index,
  )
  const routeLineWidth = Math.min(0.9, Math.max(0.55, field.width * 0.0046))
  const routeHaloWidth = routeLineWidth + Math.max(0.5, field.width * 0.0045)
  const connectorWidth = Math.max(0.5, field.width * 0.0041)

  return (
    <svg
      viewBox={`0 0 ${layout.pageWidth} ${layout.pageHeight}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel ?? 'Route tree print preview'}
    >
      <rect width={layout.pageWidth} height={layout.pageHeight} fill={layout.paper} />
      <rect
        x={field.x}
        y={field.y}
        width={field.width}
        height={field.height}
        fill={layout.fieldFill}
        stroke={layout.line}
        strokeWidth={0.3}
      />

      {layout.header && (
        <g>
          <text
            x={layout.margin}
            y={layout.header.eyebrowY}
            fill={layout.inkSoft}
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize={layout.header.eyebrowSize}
            fontWeight={700}
          >
            {layout.header.eyebrow}
          </text>
          <text
            x={layout.margin}
            y={layout.header.titleY}
            fill={layout.ink}
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize={layout.header.titleSize}
            fontWeight={700}
          >
            {layout.header.title}
          </text>
          <text
            x={layout.margin}
            y={layout.header.subtitleY}
            fill={layout.inkSoft}
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize={layout.header.subtitleSize}
          >
            {layout.header.subtitle}
          </text>
          <text
            x={layout.pageWidth - layout.margin}
            y={layout.header.metaY}
            fill={layout.ink}
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize={layout.header.metaSize}
            fontWeight={700}
            textAnchor="end"
          >
            {layout.header.meta}
          </text>
          <text
            x={layout.pageWidth - layout.margin}
            y={layout.header.metaDetailY}
            fill={layout.inkSoft}
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize={layout.header.metaSize * 0.64}
            textAnchor="end"
          >
            {layout.header.metaDetail}
          </text>
          <line
            x1={layout.margin}
            y1={layout.header.ruleY}
            x2={layout.pageWidth - layout.margin}
            y2={layout.header.ruleY}
            stroke={layout.line}
            strokeWidth={0.3}
          />
        </g>
      )}

      {layout.showFieldLines && (
        <g>
          {hashYards.map((yards) => (
            <g key={`hash-${yards}`}>
              <line
                x1={field.x}
                y1={mapY(yards)}
                x2={field.x + 0.65}
                y2={mapY(yards)}
                stroke="#ECE8DB"
                strokeWidth={0.1}
              />
              <line
                x1={field.x + field.width - 0.65}
                y1={mapY(yards)}
                x2={field.x + field.width}
                y2={mapY(yards)}
                stroke="#ECE8DB"
                strokeWidth={0.1}
              />
            </g>
          ))}
          {[5, 10, 15].map((yards) => (
            <line
              key={yards}
              x1={field.x}
              y1={mapY(yards)}
              x2={field.x + field.width}
              y2={mapY(yards)}
              stroke="#ECE8DB"
              strokeWidth={0.16}
            />
          ))}
          <line
            x1={field.x}
            y1={mapY(0)}
            x2={field.x + field.width}
            y2={mapY(0)}
            stroke="#C7C2B1"
            strokeWidth={0.22}
            strokeDasharray="0.9 0.65"
          />
          <text
            x={field.x + 1.6}
            y={mapY(0) - 1.1}
            fill={layout.inkSoft}
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize={1.95}
          >
            LOS
          </text>
          {[5, 10, 15].map((yards) => (
            <text
              key={`label-${yards}`}
              x={field.x + field.width - 1.5}
              y={mapY(yards) - 1.1}
              fill={layout.inkSoft}
              fontFamily="Helvetica, Arial, sans-serif"
              fontSize={1.8}
              textAnchor="end"
            >
              {yards}
            </text>
          ))}
        </g>
      )}

      <g>
        {layout.routes.map((route) => {
          const dash = route.dash ? route.dash.join(' ') : undefined
          const points = route.points.map((point) => `${point.x},${point.y}`).join(' ')
          return (
            <g key={`route-${route.number}`}>
              <polyline
                points={points}
                fill="none"
                stroke={layout.fieldFill}
                strokeWidth={routeHaloWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={dash}
              />
              <polyline
                points={points}
                fill="none"
                stroke={route.color}
                strokeWidth={routeLineWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={dash}
              />
              <line
                x1={route.end.x}
                y1={route.end.y}
                x2={route.badge.x}
                y2={route.badge.y}
                stroke={layout.fieldFill}
                strokeWidth={routeHaloWidth}
                strokeLinecap="round"
                strokeDasharray={dash}
              />
              <line
                x1={route.end.x}
                y1={route.end.y}
                x2={route.badge.x}
                y2={route.badge.y}
                stroke={route.color}
                strokeWidth={connectorWidth}
                strokeLinecap="round"
                strokeDasharray={dash}
              />
            </g>
          )
        })}
      </g>

      <g>
        {layout.routes.map((route) => (
          <g key={`badge-${route.number}`}>
            <circle
              cx={route.badge.x}
              cy={route.badge.y}
              r={route.badgeRadius + 0.55}
              fill={layout.paper}
            />
            <circle
              cx={route.badge.x}
              cy={route.badge.y}
              r={route.badgeRadius}
              fill={route.color}
            />
            <text
              x={route.badge.x}
              y={route.badge.y + 0.04}
              fill={route.badgeInk}
              fontFamily="Helvetica, Arial, sans-serif"
              fontSize={route.numberSize}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {route.number}
            </text>
          </g>
        ))}
      </g>

      <g>
        <circle
          cx={layout.origin.x}
          cy={layout.origin.y}
          r={layout.origin.radius}
          fill={layout.ink}
        />
        <circle
          cx={layout.origin.x}
          cy={layout.origin.y}
          r={layout.origin.radius - 0.2}
          fill="none"
          stroke={layout.paper}
          strokeWidth={0.55}
        />
        <text
          x={layout.origin.x}
          y={layout.origin.y + 0.05}
          fill="#FFFFFF"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize={layout.origin.labelSize}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
        >
          WR
        </text>
      </g>

      {layout.legend && (
        <g>
          <text
            x={layout.legend.x}
            y={layout.legend.titleY}
            fill={layout.ink}
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize={layout.legend.titleSize}
            fontWeight={700}
          >
            ROUTE INDEX
          </text>
          <text
            x={layout.legend.countX}
            y={layout.legend.countY}
            fill={layout.inkSoft}
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize={layout.legend.countSize}
            textAnchor="end"
          >
            1–9 + 0
          </text>
          <line
            x1={layout.legend.x}
            y1={layout.legend.titleY + layout.legend.titleSize * 0.85}
            x2={layout.legend.x + layout.legend.width}
            y2={layout.legend.titleY + layout.legend.titleSize * 0.85}
            stroke={layout.line}
            strokeWidth={0.2}
          />
          {layout.legend.entries.map((entry) => (
            <g key={`legend-${entry.number}`}>
              <circle cx={entry.chipX} cy={entry.chipY} r={entry.chipRadius} fill={entry.color} />
              <text
                x={entry.chipX}
                y={entry.chipY + 0.02}
                fill={entry.badgeInk}
                fontFamily="Helvetica, Arial, sans-serif"
                fontSize={entry.chipRadius * 0.95}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {entry.number}
              </text>
              <text
                x={entry.nameX}
                y={entry.nameY}
                fill={layout.ink}
                fontFamily="Helvetica, Arial, sans-serif"
                fontSize={entry.nameSize}
                fontWeight={700}
                dominantBaseline="middle"
              >
                {entry.name}
              </text>
              <text
                x={entry.groupX}
                y={entry.groupY}
                fill={layout.inkSoft}
                fontFamily="Helvetica, Arial, sans-serif"
                fontSize={entry.groupSize}
                dominantBaseline="middle"
              >
                {entry.group.toUpperCase()}
              </text>
            </g>
          ))}
        </g>
      )}

      <line
        x1={layout.margin}
        y1={layout.footer.ruleY}
        x2={layout.pageWidth - layout.margin}
        y2={layout.footer.ruleY}
        stroke={layout.line}
        strokeWidth={0.25}
      />
      <text
        x={layout.margin}
        y={layout.footer.y}
        fill={layout.inkSoft}
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize={layout.footer.size}
      >
        {layout.footer.left}
      </text>
      <text
        x={layout.pageWidth - layout.margin}
        y={layout.footer.y}
        fill={layout.inkSoft}
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize={layout.footer.size}
        textAnchor="end"
      >
        {layout.footer.right}
      </text>
    </svg>
  )
}
