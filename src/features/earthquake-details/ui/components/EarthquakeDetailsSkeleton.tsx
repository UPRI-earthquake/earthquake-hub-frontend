
export default function EarthquakeDetailSkeleton({ onRetry }) {
  return (
    <>
      <div className="eqinfo-shell eqinfo-skeleton-page" role="status" aria-live="polite" aria-busy="true">
        <section className="eqinfo-hero eqinfo-hero-skeleton">
          <SkeletonBlock className="eqinfo-skeleton-title" />
          <div className="eqinfo-meta-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="metric-card eqinfo-skeleton-card" key={`detail-skeleton-metric-${index}`}>
                <div className="metric-card-head">
                  <SkeletonBlock className="eqinfo-skeleton-icon" />
                  <SkeletonBlock className="eqinfo-skeleton-label" />
                </div>
                <div className="metric-card-body">
                  <SkeletonBlock className="eqinfo-skeleton-value" />
                  <SkeletonBlock className="eqinfo-skeleton-caption" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="eqinfo-main-columns">
          <div className="eqinfo-main-column">
            <section className="eqinfo-panel eqinfo-skeleton-panel">
              <SkeletonBlock className="eqinfo-skeleton-heading" />
              <SkeletonBlock className="eqinfo-skeleton-line" />
              <SkeletonBlock className="eqinfo-skeleton-line eqinfo-skeleton-line-wide" />
              <SkeletonBlock className="eqinfo-skeleton-line eqinfo-skeleton-line-short" />
            </section>
            <section className="eqinfo-panel eqinfo-skeleton-panel">
              <SkeletonBlock className="eqinfo-skeleton-heading" />
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock className="eqinfo-skeleton-list-row" key={`detail-skeleton-related-${index}`} />
              ))}
            </section>
          </div>

          <div className="eqinfo-main-column eqinfo-main-column-community">
            <section className="eqinfo-panel eqinfo-skeleton-panel">
              <div className="report-section-header">
                <SkeletonBlock className="eqinfo-skeleton-heading" />
                <SkeletonBlock className="eqinfo-skeleton-button" />
              </div>
              <SkeletonBlock className="eqinfo-skeleton-media" />
            </section>
            <section className="eqinfo-panel eqinfo-skeleton-panel">
              <SkeletonBlock className="eqinfo-skeleton-heading" />
              <SkeletonBlock className="eqinfo-skeleton-line eqinfo-skeleton-line-wide" />
              <SkeletonBlock className="eqinfo-skeleton-line" />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}


function SkeletonBlock({ className = '' }) {
  return <span className={`eqinfo-skeleton-block ${className}`} aria-hidden="true" />;
}
