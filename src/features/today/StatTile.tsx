export interface StatTileProps {
  /** The real count derived by a `dashboardModel` selector. */
  value: number;
  /** Plain-text label — the tile never relies on colour alone. */
  label: string;
}

/**
 * Compact stat tile for the "At a glance" row: big tabular number plus a
 * visible text label, sharp corners and the shared border/card tokens.
 */
export function StatTile({ value, label }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 border border-border bg-card px-3 py-2.5 transition-colors duration-150">
      <span className="text-xl font-semibold leading-none tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
