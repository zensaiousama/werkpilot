'use client';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface MiniBarChartProps {
  data: BarData[];
  height?: number;
  barWidth?: number;
  gap?: number;
  showLabels?: boolean;
  showValues?: boolean;
  defaultColor?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  animate?: boolean;
}

export default function MiniBarChart({
  data,
  height = 120,
  barWidth = 28,
  gap = 6,
  showLabels = true,
  showValues = true,
  defaultColor = 'var(--amber)',
  valuePrefix = '',
  valueSuffix = '',
  animate = true,
}: MiniBarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const totalWidth = data.length * (barWidth + gap) - gap;
  const labelHeight = showLabels ? 20 : 0;
  const valueHeight = showValues ? 16 : 0;
  const chartHeight = height - labelHeight - valueHeight;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${totalWidth + 8} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: totalWidth + 8 }}
      >
        {data.map((d, i) => {
          const barH = (d.value / maxValue) * chartHeight;
          const x = i * (barWidth + gap) + 4;
          const y = valueHeight + (chartHeight - barH);
          const color = d.color || defaultColor;

          return (
            <g key={d.label}>
              {/* Bar background */}
              <rect
                x={x}
                y={valueHeight}
                width={barWidth}
                height={chartHeight}
                rx={4}
                fill="rgba(255,255,255,0.03)"
              />
              {/* Bar fill */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={4}
                fill={color}
                opacity={0.85}
                style={
                  animate
                    ? {
                        transition: 'height 0.6s ease, y 0.6s ease',
                      }
                    : undefined
                }
              />
              {/* Glow */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.min(barH, 3)}
                rx={4}
                fill={color}
                opacity={0.5}
              />
              {/* Value label */}
              {showValues && (
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    fill: color,
                    fontWeight: 700,
                  }}
                >
                  {valuePrefix}
                  {d.value >= 1000
                    ? `${(d.value / 1000).toFixed(1)}k`
                    : d.value.toLocaleString('de-CH')}
                  {valueSuffix}
                </text>
              )}
              {/* Label */}
              {showLabels && (
                <text
                  x={x + barWidth / 2}
                  y={height - 2}
                  textAnchor="middle"
                  style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    fill: 'var(--text-muted)',
                  }}
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Donut Chart Component                                              */
/* ------------------------------------------------------------------ */

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  data,
  size = 140,
  strokeWidth = 16,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let accumulated = 0;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        {/* Segments */}
        {data.map((segment) => {
          const pct = total > 0 ? segment.value / total : 0;
          const dashLen = pct * circumference;
          const gapLen = circumference - dashLen;
          const offset = -(accumulated / total) * circumference;
          accumulated += segment.value;

          return (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${dashLen} ${gapLen}`}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease' }}
            />
          );
        })}
      </svg>
      {/* Center text */}
      {(centerLabel || centerValue) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {centerValue && (
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
                lineHeight: 1,
              }}
            >
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                marginTop: 4,
              }}
            >
              {centerLabel}
            </span>
          )}
        </div>
      )}

      {/* Legend */}
      {data.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 16px',
            marginTop: 12,
            justifyContent: 'center',
          }}
        >
          {data.map((segment) => (
            <div key={segment.label} className="flex items-center gap-1.5">
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: segment.color,
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {segment.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sparkline Component                                                */
/* ------------------------------------------------------------------ */

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
}

export function Sparkline({
  data,
  width = 100,
  height = 28,
  color = 'var(--amber)',
  filled = true,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const linePoints = points.join(' ');
  const areaPoints = `${padding},${height - padding} ${linePoints} ${width - padding},${height - padding}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {filled && (
        <polygon
          points={areaPoints}
          fill={color}
          opacity={0.1}
        />
      )}
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (
        <circle
          cx={parseFloat(points[points.length - 1].split(',')[0])}
          cy={parseFloat(points[points.length - 1].split(',')[1])}
          r={2.5}
          fill={color}
        />
      )}
    </svg>
  );
}
