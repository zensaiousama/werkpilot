'use client';

/**
 * Reusable skeleton loading components for the dashboard.
 * Uses CSS shimmer animation for smooth loading states.
 */

const shimmerStyle = `
@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

function SkeletonBase({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-lg ${className}`}
      style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.8s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

/** Inline text placeholder */
export function SkeletonText({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <SkeletonBase style={{ width, height, borderRadius: 6 }} />;
}

/** A rectangular card placeholder */
export function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <SkeletonBase
      style={{
        height,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.04)',
      }}
    />
  );
}

/** Circle placeholder (avatar, icon) */
export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return <SkeletonBase style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />;
}

/** KPI stat card skeleton */
export function SkeletonKPI() {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <SkeletonText width={80} height={12} />
        <SkeletonCircle size={32} />
      </div>
      <SkeletonText width={120} height={28} />
      <div className="mt-2">
        <SkeletonText width={60} height={12} />
      </div>
    </div>
  );
}

/** Table row skeleton */
export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonText
          key={i}
          width={i === 0 ? '25%' : i === cols - 1 ? '10%' : '15%'}
          height={14}
        />
      ))}
    </div>
  );
}

/** Full page loading skeleton with KPI cards + table */
export function PageSkeleton({ title }: { title?: string }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: shimmerStyle }} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          {title ? (
            <h1
              className="text-xl md:text-2xl font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', opacity: 0.3 }}
            >
              {title}
            </h1>
          ) : (
            <SkeletonText width={160} height={28} />
          )}
          <SkeletonText width={120} height={36} />
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
        </div>

        {/* Table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {/* Table header */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <SkeletonText width={200} height={14} />
          </div>
          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </div>
      </div>
    </>
  );
}

/** Dashboard-specific skeleton with KPI cards + charts */
export function DashboardSkeleton() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: shimmerStyle }} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <SkeletonText width={200} height={28} />
            <div className="mt-2">
              <SkeletonText width={300} height={14} />
            </div>
          </div>
          <SkeletonText width={100} height={36} />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} height={72} />
          ))}
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SkeletonCard height={300} />
          </div>
          <SkeletonCard height={300} />
        </div>
      </div>
    </>
  );
}

export default SkeletonBase;
