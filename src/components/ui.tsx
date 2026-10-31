import { INFINITE_GAMES } from "@/domain/infinite-games";

export function GamesPicker({ selected = [] }: { selected?: readonly string[] }) {
  return (
    <fieldset className="flex flex-wrap gap-x-3 gap-y-1">
      <legend className="label mb-1">Infinite Games</legend>
      {INFINITE_GAMES.map((game) => (
        <label key={game} className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="games" value={game} defaultChecked={selected.includes(game)} />
          {game}
        </label>
      ))}
    </fieldset>
  );
}

export function GameTags({ games }: { games: readonly string[] }) {
  if (games.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {games.map((game) => (
        <span key={game} className="rounded-full border border-line px-1.5 text-[11px] text-muted">
          {game}
        </span>
      ))}
    </span>
  );
}

export function Hidden(props: Record<string, string>) {
  return (
    <>
      {Object.entries(props).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

export function AddIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="-my-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-lg leading-none text-muted hover:bg-line hover:text-foreground"
    >
      +
    </button>
  );
}

export function PageTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold tracking-tight">{children}</h1>
      {aside}
    </div>
  );
}
