'use client';

const NODE_STYLES = {
  primary: {
    fill: '#f7f7f4',
    stroke: '#d97706',
    strokeWidth: 1.5,
    textColor: '#26251e',
    subtitleColor: '#26251e99',
  },
  secondary: {
    fill: '#f2f1ed',
    stroke: '#26251e1a',
    strokeWidth: 1,
    textColor: '#26251e99',
    subtitleColor: '#26251e66',
  },
} as const;

interface DiagramNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  variant?: keyof typeof NODE_STYLES;
}

function DiagramNode({
  x,
  y,
  width,
  height,
  title,
  subtitle,
  variant = 'primary',
}: DiagramNodeProps) {
  const style = NODE_STYLES[variant];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        ry={8}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - 6}
        textAnchor="middle"
        fill={style.textColor}
        fontSize="12"
        fontWeight="600"
        fontFamily="inherit"
      >
        {title}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 10}
        textAnchor="middle"
        fill={style.subtitleColor}
        fontSize="9"
        fontFamily="inherit"
      >
        {subtitle}
      </text>
    </g>
  );
}

interface ConnectionLineProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  dashed?: boolean;
}

function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  dashed = false,
}: ConnectionLineProps) {
  return (
    <line
      x1={fromX}
      y1={fromY}
      x2={toX}
      y2={toY}
      stroke="#26251e1a"
      strokeWidth={1}
      strokeDasharray={dashed ? '4 3' : undefined}
      markerEnd="url(#arrowhead)"
    />
  );
}

interface ArchitectureDiagramProps {
  compact?: boolean;
}

export function ArchitectureDiagram({
  compact = false,
}: ArchitectureDiagramProps) {
  const viewBoxWidth = 600;
  const viewBoxHeight = compact ? 280 : 340;

  const centerX = viewBoxWidth / 2;

  const connectionWidth = 120;
  const connectionHeight = 52;
  const connectionX = centerX - 260;
  const connectionY = 60;

  const requesterWidth = 120;
  const requesterHeight = 52;
  const requesterX = centerX - 60;
  const requesterY = 60;

  const parserWidth = 120;
  const parserHeight = 52;
  const parserX = centerX + 140;
  const parserY = 60;

  const pubsubWidth = 120;
  const pubsubHeight = 52;
  const pubsubX = centerX - 160;
  const pubsubY = 160;

  const debugWidth = 120;
  const debugHeight = 52;
  const debugX = centerX + 40;
  const debugY = 160;

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      className="w-full h-auto"
      role="img"
      aria-label="Solidis architecture diagram"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#26251e33" />
        </marker>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        x={16}
        y={16}
        width={viewBoxWidth - 32}
        height={viewBoxHeight - 32}
        rx={12}
        ry={12}
        fill="none"
        stroke="#26251e0d"
        strokeWidth={1}
      />
      <text
        x={centerX}
        y={40}
        textAnchor="middle"
        fill="#26251e99"
        fontSize="11"
        fontWeight="500"
        fontFamily="inherit"
      >
        SolidisClient
      </text>

      <ConnectionLine
        fromX={connectionX + connectionWidth}
        fromY={connectionY + connectionHeight / 2}
        toX={requesterX}
        toY={requesterY + requesterHeight / 2}
      />
      <ConnectionLine
        fromX={requesterX + requesterWidth}
        fromY={requesterY + requesterHeight / 2}
        toX={parserX}
        toY={parserY + parserHeight / 2}
      />
      <ConnectionLine
        fromX={requesterX + requesterWidth / 2}
        fromY={requesterY + requesterHeight}
        toX={pubsubX + pubsubWidth / 2}
        toY={pubsubY}
      />
      <ConnectionLine
        fromX={requesterX + requesterWidth / 2}
        fromY={requesterY + requesterHeight}
        toX={debugX + debugWidth / 2}
        toY={debugY}
        dashed
      />

      <DiagramNode
        x={connectionX}
        y={connectionY}
        width={connectionWidth}
        height={connectionHeight}
        title="Connection"
        subtitle="TCP · TLS · Reconnect"
      />
      <DiagramNode
        x={requesterX}
        y={requesterY}
        width={requesterWidth}
        height={requesterHeight}
        title="Requester"
        subtitle="Queue · Pipeline · Timeout"
      />
      <DiagramNode
        x={parserX}
        y={parserY}
        width={parserWidth}
        height={parserHeight}
        title="Parser"
        subtitle="RESP2 · RESP3 · Zero-copy"
      />
      <DiagramNode
        x={pubsubX}
        y={pubsubY}
        width={pubsubWidth}
        height={pubsubHeight}
        title="PubSub"
        subtitle="Channel · Pattern · Shard"
      />
      <DiagramNode
        x={debugX}
        y={debugY}
        width={debugWidth}
        height={debugHeight}
        title="Debug Memory"
        subtitle="Ring buffer · Sanitized"
        variant="secondary"
      />

      {!compact && (
        <g>
          <line
            x1={centerX - 100}
            y1={viewBoxHeight - 60}
            x2={centerX + 100}
            y2={viewBoxHeight - 60}
            stroke="#26251e0d"
            strokeWidth={1}
          />
          <text
            x={centerX - 80}
            y={viewBoxHeight - 40}
            textAnchor="middle"
            fill="#26251e"
            fontSize="9"
            fontFamily="inherit"
          >
            SolidisClient
          </text>
          <text
            x={centerX + 80}
            y={viewBoxHeight - 40}
            textAnchor="middle"
            fill="#26251e"
            fontSize="9"
            fontFamily="inherit"
          >
            SolidisFeaturedClient
          </text>
          <text
            x={centerX - 80}
            y={viewBoxHeight - 28}
            textAnchor="middle"
            fill="#26251e99"
            fontSize="8"
            fontFamily="inherit"
          >
            tree-shakable
          </text>
          <text
            x={centerX + 80}
            y={viewBoxHeight - 28}
            textAnchor="middle"
            fill="#26251e99"
            fontSize="8"
            fontFamily="inherit"
          >
            all commands
          </text>
        </g>
      )}
    </svg>
  );
}
