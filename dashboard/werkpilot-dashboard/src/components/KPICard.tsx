'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title?: string;
  label?: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  color?: string;
  sparkData?: number[];
  isLoading?: boolean;
  delay?: number;
  prefix?: string;
}

/* -------------------------------------------------- */
/* Smooth count-up using requestAnimationFrame         */
/* -------------------------------------------------- */
function useCountUp(target: number, duration = 1200, startDelay = 0) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let start: number | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(step);
    }, startDelay);

    return () => {
      if (timeout) clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, startDelay]);

  return display;
}

/* -------------------------------------------------- */
/* Mini Sparkline (inline SVG) - wider, gradient fill  */
/* -------------------------------------------------- */
function Sparkline({ data, color, uid }: { data: number[]; color: string; uid: string }) {
  const width = 280;
  const height = 40;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Build smooth curve points
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return { x, y };
  });

  // Build a smooth cubic bezier path for a polished look
  let pathD = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cpx = (curr.x + next.x) / 2;
    pathD += ` C${cpx},${curr.y} ${cpx},${next.y} ${next.x},${next.y}`;
  }

  // Area fill path (close to bottom)
  const areaD = `${pathD} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  const gradientId = `spark-fill-${uid}`;
  const strokeGradientId = `spark-stroke-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="60%" stopColor={color} stopOpacity="0.1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={strokeGradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path
        d={areaD}
        fill={`url(#${gradientId})`}
      />
      <path
        d={pathD}
        fill="none"
        stroke={`url(#${strokeGradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Animated endpoint dot with glow */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="5"
        fill={color}
        opacity="0.3"
      >
        <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0.15;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="3"
        fill={color}
      />
    </svg>
  );
}

/* -------------------------------------------------- */
/* Loading Skeleton                                    */
/* -------------------------------------------------- */
function KPICardSkeleton() {
  return (
    <div
      className="p-6 rounded-2xl relative overflow-hidden"
      style={{
        background: 'rgba(18, 21, 31, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="skeleton" style={{ width: 90, height: 12, borderRadius: 6, marginBottom: 14 }} />
          <div className="skeleton" style={{ width: 140, height: 34, borderRadius: 10 }} />
        </div>
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 22 }} />
      </div>
      <div className="skeleton" style={{ width: 80, height: 24, borderRadius: 12, marginBottom: 10 }} />
      <div className="skeleton" style={{ width: '100%', height: 40, borderRadius: 8 }} />
    </div>
  );
}

/* -------------------------------------------------- */
/* Main KPICard - Premium Glassmorphism Design         */
/* -------------------------------------------------- */
export default function KPICard({
  title,
  label,
  value,
  trend,
  trendLabel = 'vs. Vormonat',
  icon,
  color = 'var(--amber)',
  sparkData,
  isLoading = false,
  delay = 0,
  prefix,
}: KPICardProps) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, '');

  // Resolve title from either prop (label is legacy compat)
  const displayTitle = title || label || '';

  // Determine if value is numeric for count-up
  const numericValue = typeof value === 'number' ? value : null;
  const animatedNumber = useCountUp(numericValue ?? 0, 1200, delay + 200);

  // Entrance animation with delay
  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  if (isLoading) return <KPICardSkeleton />;

  // Generate default sparkData if none provided and value is numeric
  const resolvedSparkData =
    sparkData ??
    (numericValue !== null
      ? Array.from({ length: 12 }, (_, i) => {
          const base = numericValue * 0.7;
          const growth = (numericValue - base) * (i / 11);
          const noise = numericValue * 0.04 * (Math.sin(i * 1.8) + Math.cos(i * 0.7));
          return Math.round(base + growth + noise);
        })
      : undefined);

  const formattedValue =
    numericValue !== null
      ? `${prefix ?? ''}${animatedNumber.toLocaleString('de-CH')}`
      : `${prefix ?? ''}${value}`;

  const rgbaColor = colorToRgba(color, 1);
  const rgbaColorMid = colorToRgba(color, 0.5);
  const rgbaColorDim = colorToRgba(color, 0.15);
  const rgbaColorFaint = colorToRgba(color, 0.06);

  return (
    <div
      ref={cardRef}
      className="group relative rounded-2xl"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? hovered
            ? 'translateY(-6px)'
            : 'translateY(0)'
          : 'translateY(20px)',
        transition: `
          opacity 600ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms,
          transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1),
          filter 400ms ease
        `,
        cursor: 'default',
        filter: hovered ? `drop-shadow(0 4px 30px ${colorToRgba(color, 0.2)})` : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ---- Animated gradient border container ---- */}
      <div
        className="absolute inset-0 rounded-2xl overflow-hidden"
        style={{
          padding: '1px',
          background: hovered
            ? `linear-gradient(135deg, ${rgbaColor}, ${rgbaColorMid}, ${rgbaColorDim}, ${rgbaColorMid}, ${rgbaColor})`
            : `linear-gradient(180deg, ${rgbaColorMid} 0%, var(--border) 30%, var(--border) 100%)`,
          transition: 'background 500ms ease',
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
        }}
      />

      {/* ---- Glass card body ---- */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(160deg, rgba(18, 21, 31, 0.8) 0%, rgba(18, 21, 31, 0.95) 100%)`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: hovered
            ? `0 12px 48px rgba(0,0,0,0.4), 0 0 40px ${colorToRgba(color, 0.12)}, inset 0 1px 0 ${colorToRgba(color, 0.08)}`
            : `0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)`,
          transition: 'box-shadow 400ms ease',
        }}
      >
        {/* ---- Top gradient border line ---- */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, transparent 0%, ${rgbaColor} 20%, ${rgbaColorMid} 50%, ${rgbaColor} 80%, transparent 100%)`,
            opacity: hovered ? 1 : 0.7,
            transition: 'opacity 400ms ease',
          }}
        />

        {/* ---- Radial glow behind icon (top-right) ---- */}
        <div
          style={{
            position: 'absolute',
            top: '-30px',
            right: '-30px',
            width: '140px',
            height: '140px',
            background: `radial-gradient(circle, ${colorToRgba(color, hovered ? 0.18 : 0.08)} 0%, transparent 70%)`,
            pointerEvents: 'none',
            transition: 'background 400ms ease',
          }}
        />

        {/* ---- Shine / sheen sweep on hover ---- */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 55%, transparent 60%)',
            transform: hovered ? 'translateX(100%)' : 'translateX(-100%)',
            transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
          }}
        />

        {/* ---- Ambient glow on hover ---- */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at top center, ${rgbaColorFaint}, transparent 70%)`,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 400ms ease',
            pointerEvents: 'none',
          }}
        />

        {/* ---- Card Content ---- */}
        <div className="relative z-10 p-6">
          {/* Header: Label + Icon */}
          <div className="flex items-start justify-between mb-2">
            <p
              className="text-[11px] uppercase tracking-wider font-medium"
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
              }}
            >
              {displayTitle}
            </p>
            {icon && (
              <div className="relative shrink-0">
                {/* Sonar pulse rings on hover */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: colorToRgba(color, 0.15),
                    transform: hovered ? 'scale(1.8)' : 'scale(1)',
                    opacity: hovered ? 0 : 0.3,
                    transition: hovered
                      ? 'transform 1s ease-out, opacity 1s ease-out'
                      : 'transform 0.3s ease, opacity 0.3s ease',
                    animation: hovered ? 'sonarPing 1.5s ease-out infinite' : 'none',
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: colorToRgba(color, 0.1),
                    transform: hovered ? 'scale(1.5)' : 'scale(1)',
                    opacity: hovered ? 0 : 0.2,
                    transition: hovered
                      ? 'transform 1s ease-out 0.2s, opacity 1s ease-out 0.2s'
                      : 'transform 0.3s ease, opacity 0.3s ease',
                    animation: hovered ? 'sonarPing 1.5s ease-out 0.4s infinite' : 'none',
                  }}
                />
                {/* Icon circle */}
                <div
                  className="relative w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: colorToRgba(color, hovered ? 0.2 : 0.1),
                    boxShadow: hovered
                      ? `0 0 20px ${colorToRgba(color, 0.2)}, inset 0 0 12px ${colorToRgba(color, 0.08)}`
                      : 'none',
                    transform: hovered ? 'scale(1.08)' : 'scale(1)',
                    transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  {icon}
                </div>
              </div>
            )}
          </div>

          {/* Large Value */}
          <p
            className="text-3xl font-extrabold mt-1"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text)',
              letterSpacing: '0.02em',
              lineHeight: 1.15,
              textShadow: hovered ? `0 0 30px ${colorToRgba(color, 0.15)}` : 'none',
              transition: 'text-shadow 400ms ease',
            }}
          >
            {formattedValue}
          </p>

          {/* Trend Indicator */}
          {trend !== undefined && (
            <div className="flex items-center gap-2 mt-3">
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: trend >= 0
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.08) 100%)'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.08) 100%)',
                  color: trend >= 0 ? 'var(--green)' : 'var(--red)',
                  fontFamily: 'var(--font-mono)',
                  border: `1px solid ${trend >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
                  boxShadow: trend >= 0
                    ? '0 2px 8px rgba(34, 197, 94, 0.1)'
                    : '0 2px 8px rgba(239, 68, 68, 0.1)',
                  letterSpacing: '0.02em',
                }}
              >
                {trend >= 0 ? (
                  <TrendingUp size={13} strokeWidth={2.5} />
                ) : (
                  <TrendingDown size={13} strokeWidth={2.5} />
                )}
                {trend > 0 ? '+' : ''}
                {trend}%
              </div>
              <span
                className="text-[11px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {trendLabel}
              </span>
            </div>
          )}

          {/* Full-width Sparkline */}
          {resolvedSparkData && resolvedSparkData.length > 1 && (
            <div className="mt-4 -mx-2">
              <Sparkline data={resolvedSparkData} color={color} uid={uid} />
            </div>
          )}
        </div>
      </div>

      {/* ---- Inject keyframe animation for sonar pulse ---- */}
      <style>{`
        @keyframes sonarPing {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------- */
/* Utility: resolve CSS variable to rgba string        */
/* Falls back to parsing the raw value                 */
/* -------------------------------------------------- */
function colorToRgba(color: string, alpha: number): string {
  // Map common CSS variable names to their actual colors
  const varMap: Record<string, string> = {
    'var(--amber)': `rgba(245,158,11,${alpha})`,
    'var(--green)': `rgba(34,197,94,${alpha})`,
    'var(--blue)': `rgba(96,165,250,${alpha})`,
    'var(--purple)': `rgba(139,92,246,${alpha})`,
    'var(--red)': `rgba(239,68,68,${alpha})`,
    'var(--orange)': `rgba(249,115,22,${alpha})`,
  };

  if (varMap[color]) return varMap[color];

  // Hex color
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Fallback
  return `rgba(245,158,11,${alpha})`;
}
