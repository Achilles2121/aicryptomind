import { useEffect, useRef, useState } from "react";

export function useDataFetch(fetcher, deps = [], options = {}) {
  const [data, setData] = useState(options.initialData ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetcher();
        if (mounted.current) setData(response);
      } catch (err) {
        if (mounted.current) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (mounted.current) setLoading(false);
      }
    };
    run();
    const interval = options.refreshMs
      ? setInterval(run, options.refreshMs)
      : undefined;
    return () => {
      mounted.current = false;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = async () => {
    try {
      const response = await fetcher();
      if (mounted.current) {
        setData(response);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return { data, loading, error, refresh };
}
