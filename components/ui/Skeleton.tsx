interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({
  className = "",
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function ScenarioCardSkeleton() {
  return (
    <article className="card skeleton-card" aria-hidden="true">
      <Skeleton className="skeleton-title" height="1rem" width="60%" />
      <Skeleton className="skeleton-line" height="0.85rem" width="80%" />
      <Skeleton className="skeleton-badge" height="1.25rem" width="4rem" />
      <Skeleton className="skeleton-line" height="0.82rem" width="90%" />
      <div className="skeleton-list">
        <Skeleton height="0.8rem" width="85%" />
        <Skeleton height="0.8rem" width="75%" />
        <Skeleton height="0.8rem" width="70%" />
      </div>
    </article>
  );
}
