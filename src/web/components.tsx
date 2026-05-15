import type { SortDir } from "./hooks.js";

// Hover-tooltip text reused everywhere we surface a KDA value or column.
export const KDA_TOOLTIP =
  "KDA = (Kills + Assists) / Deaths. Players with 0 deaths are shown as K + A (a 'perfect' KDA).";

export function SortableHeader({
  id,
  label,
  sortId,
  sortDir,
  onClick,
  className,
  title,
}: {
  id: string;
  label: string;
  sortId: string;
  sortDir: SortDir;
  onClick: (id: string) => void;
  className?: string;
  title?: string;
}) {
  const active = sortId === id;
  return (
    <th
      className={`sortable${className ? " " + className : ""}`}
      onClick={() => onClick(id)}
      title={title}
    >
      {label}
      {active && (
        <span className="sort-indicator">{sortDir === "desc" ? "▼" : "▲"}</span>
      )}
    </th>
  );
}

export function TableFilter({
  value,
  onChange,
  count,
  placeholder = "Filter…",
}: {
  value: string;
  onChange: (v: string) => void;
  count?: number;
  placeholder?: string;
}) {
  return (
    <div className="table-controls">
      <input
        className="filter"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {count !== undefined && (
        <span className="result-count">
          {count} {count === 1 ? "row" : "rows"}
        </span>
      )}
    </div>
  );
}
