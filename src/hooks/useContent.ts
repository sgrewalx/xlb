import { useEffect, useState } from "react";

interface ContentState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

interface UseContentOptions {
  refreshMs?: number;
}

export function useContent<T>(path: string, options: UseContentOptions = {}) {
  const [state, setState] = useState<ContentState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function load(isRefresh = false) {
      setState((current) => ({
        data: isRefresh ? current.data : null,
        error: null,
        loading: true,
      }));

      try {
        const response = await fetch(path, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        const json = (await response.json()) as T;
        setState({ data: json, error: null, loading: false });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Unknown fetch error";
        setState((current) => ({
          data: current.data,
          error: message,
          loading: false,
        }));
      }
    }

    void load();
    const interval =
      options.refreshMs && options.refreshMs > 0
        ? window.setInterval(() => void load(true), options.refreshMs)
        : null;

    return () => {
      controller.abort();
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [options.refreshMs, path]);

  return state;
}
