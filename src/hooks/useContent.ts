import { useEffect, useState } from "react";

interface ContentState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useContent<T>(path: string) {
  const [state, setState] = useState<ContentState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState({ data: null, error: null, loading: true });

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
        setState({ data: null, error: message, loading: false });
      }
    }

    void load();

    return () => controller.abort();
  }, [path]);

  return state;
}
