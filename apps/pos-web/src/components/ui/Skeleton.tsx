interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-surface-card rounded-xl shadow-card p-5 border border-gray-100">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function SkeletonPanel() {
  return (
    <div className="bg-surface-card rounded-xl shadow-card p-5 border border-gray-100">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
