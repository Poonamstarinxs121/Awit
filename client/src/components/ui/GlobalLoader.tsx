import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export function GlobalLoader() {
  const fetchingCount = useIsFetching({
    predicate: (query) =>
      query.state.fetchStatus === 'fetching' && query.state.data === undefined,
  });
  const mutatingCount = useIsMutating();
  const visible = fetchingCount + mutatingCount > 0;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[120] h-0.5 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden={!visible}
      role="status"
    >
      <div className="h-full w-full overflow-hidden bg-blue-100">
        <div className="h-full w-full animate-progress-shimmer bg-[linear-gradient(90deg,transparent_0%,#2563eb_50%,transparent_100%)]" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
