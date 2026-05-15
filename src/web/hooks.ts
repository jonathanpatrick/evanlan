import { useEffect, useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export type SortKeys<T> = Record<string, (row: T) => number | string>;

export type UseTableOptions<T> = {
  defaultSortId: string;
  defaultDir?: SortDir;
  filterFields?: (row: T) => string[];
};

// Manages filter + sort state for a data table. Pass the rows, a dictionary of
// id → getter functions (one per sortable column), and the default sort id.
// `toggleSort(id)` flips direction when the same column is re-clicked.
export function useTable<T>(
  rows: T[] | undefined,
  keys: SortKeys<T>,
  opts: UseTableOptions<T>
) {
  const [sortId, setSortId] = useState(opts.defaultSortId);
  const [sortDir, setSortDir] = useState<SortDir>(opts.defaultDir ?? "desc");
  const [filter, setFilter] = useState("");

  const processed = useMemo(() => {
    let r = rows ?? [];
    if (filter.trim() && opts.filterFields) {
      const q = filter.trim().toLowerCase();
      const matcher = opts.filterFields;
      r = r.filter((row) =>
        matcher(row).some((s) => s.toLowerCase().includes(q))
      );
    }
    const getter = keys[sortId];
    if (getter) {
      r = [...r].sort((a, b) => {
        const va = getter(a);
        const vb = getter(b);
        if (typeof va === "string" && typeof vb === "string") {
          const cmp = va.localeCompare(vb, undefined, { sensitivity: "base" });
          return sortDir === "asc" ? cmp : -cmp;
        }
        const na = Number(va);
        const nb = Number(vb);
        if (na < nb) return sortDir === "asc" ? -1 : 1;
        if (na > nb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return r;
  }, [rows, keys, sortId, sortDir, filter, opts.filterFields]);

  const toggleSort = (id: string) => {
    if (sortId === id) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortId(id);
      setSortDir("desc");
    }
  };

  return { rows: processed, filter, setFilter, sortId, sortDir, toggleSort };
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading };
}
