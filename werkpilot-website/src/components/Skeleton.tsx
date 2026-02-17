export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ backgroundColor: 'var(--color-border)', minHeight: '1rem', minWidth: '1rem' }}
      aria-hidden="true"
    />
  );
}

export function SectionSkeleton() {
  return (
    <div className="py-20" role="status" aria-label="Inhalt wird geladen">
      <div className="container mx-auto px-4 max-w-4xl">
        <SkeletonBlock className="h-10 w-2/3 mx-auto mb-6" />
        <SkeletonBlock className="h-5 w-full mb-3" />
        <SkeletonBlock className="h-5 w-5/6 mb-3" />
        <SkeletonBlock className="h-5 w-4/6 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonBlock className="h-48" />
          <SkeletonBlock className="h-48" />
          <SkeletonBlock className="h-48" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-6">
      <SkeletonBlock className="h-6 w-3/4 mb-4" />
      <SkeletonBlock className="h-4 w-full mb-2" />
      <SkeletonBlock className="h-4 w-5/6 mb-2" />
      <SkeletonBlock className="h-4 w-2/3" />
    </div>
  );
}
