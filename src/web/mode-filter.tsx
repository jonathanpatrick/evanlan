import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { gameModeLabel } from "./format.js";

type Ctx = {
  availableModes: string[];
  // null while we haven't fetched /api/modes yet. After fetch defaults to all
  // available (everything ticked). When the user toggles boxes off, this is
  // the subset they want. Empty array means "show nothing".
  selectedModes: string[] | null;
  setSelectedModes: (m: string[]) => void;
};

const ModeFilterContext = createContext<Ctx | null>(null);

export function ModeFilterProvider({ children }: { children: ReactNode }) {
  const [availableModes, setAvailableModes] = useState<string[]>([]);
  const [selectedModes, setSelectedModes] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/modes")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { modes: string[] }) => {
        setAvailableModes(data.modes);
        // Default to everything ticked on first load.
        setSelectedModes((cur) => (cur === null ? data.modes : cur));
      })
      .catch((err) => {
        console.warn("Failed to load /api/modes:", err);
        setSelectedModes([]); // unblock pages — they'll request unfiltered
      });
  }, []);

  return (
    <ModeFilterContext.Provider
      value={{ availableModes, selectedModes, setSelectedModes }}
    >
      {children}
    </ModeFilterContext.Provider>
  );
}

export function useModeFilter() {
  const ctx = useContext(ModeFilterContext);
  if (!ctx) throw new Error("useModeFilter outside provider");
  return ctx;
}

// Modes value the API should be called with. While initializing we return
// undefined so callers don't fire a request that'll need to be redone — but
// in practice useAsync will re-run when selectedModes flips from null to the
// initial array, so it's also fine to pass [] and re-fetch.
// Memoized so the dependency array of consuming useAsync calls stays stable
// when selectedModes hasn't actually changed.
export function useSelectedModes(): string[] {
  const { selectedModes } = useModeFilter();
  return useMemo(() => selectedModes ?? [], [selectedModes]);
}

export function ModeFilterBar() {
  const { availableModes, selectedModes, setSelectedModes } = useModeFilter();

  const toggle = useCallback(
    (mode: string) => {
      const current = selectedModes ?? availableModes;
      if (current.includes(mode)) {
        setSelectedModes(current.filter((m) => m !== mode));
      } else {
        setSelectedModes([...current, mode]);
      }
    },
    [selectedModes, availableModes, setSelectedModes]
  );

  if (availableModes.length === 0) return null;
  const current = selectedModes ?? availableModes;

  return (
    <div className="mode-filter-bar">
      <span className="filter-label">Game modes:</span>
      {availableModes.map((mode) => (
        <label key={mode} className="mode-checkbox">
          <input
            type="checkbox"
            checked={current.includes(mode)}
            onChange={() => toggle(mode)}
          />
          {gameModeLabel(mode)}
        </label>
      ))}
      <button
        type="button"
        className="mode-button"
        onClick={() => setSelectedModes(availableModes)}
      >
        All
      </button>
      <button
        type="button"
        className="mode-button"
        onClick={() => setSelectedModes([])}
      >
        None
      </button>
    </div>
  );
}
