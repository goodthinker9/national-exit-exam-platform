/**
 * src/lib/useCourseQuestionCounts.js
 *
 * Fetches published question counts per course uuid once, caches
 * the result in module memory for 60 seconds.
 *
 * Returns { counts, loading, error, reload }
 *   counts: Record<courseUuid, number>  (empty object while loading or on error)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getCourseQuestionCounts } from "./supabase.js";

const CACHE_TTL_MS = 60_000;
let _cache = null;       // { data: Record<string,number>, ts: number }

export function useCourseQuestionCounts() {
  const [counts,  setCounts]  = useState(_cache?.data ?? {});
  const [loading, setLoading] = useState(!_cache);
  const [error,   setError]   = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (force = false) => {
    // Use in-memory cache if fresh
    if (!force && _cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
      setCounts(_cache.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getCourseQuestionCounts();
      _cache = { data, ts: Date.now() };
      if (mountedRef.current) setCounts(data);
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return {
    counts,
    loading,
    error,
    reload: () => load(true),
  };
}
