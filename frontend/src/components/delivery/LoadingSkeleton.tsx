type LoadingSkeletonProps = {
  variant?: "list" | "stats" | "page";
  count?: number;
};

export function LoadingSkeleton({
  variant = "list",
  count = 4,
}: LoadingSkeletonProps) {
  if (variant === "stats") {
    return (
      <div className="dlv-stats" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="dlv-skeleton dlv-skeleton--stat" />
        ))}
      </div>
    );
  }
  if (variant === "page") {
    return (
      <div aria-hidden>
        <div className="dlv-stats" style={{ marginBottom: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="dlv-skeleton dlv-skeleton--stat" />
          ))}
        </div>
        <div className="dlv-skeleton" style={{ height: 44, marginBottom: 12 }} />
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="dlv-skeleton dlv-skeleton--card"
            style={{ marginBottom: 10 }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="dlv-list" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dlv-skeleton dlv-skeleton--card" />
      ))}
    </div>
  );
}
