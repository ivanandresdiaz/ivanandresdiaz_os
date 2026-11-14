"use client";

/** A small switch between a few options, like Expense / Income in the "+". */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-background p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex min-h-8 items-center gap-1 rounded-md px-2.5 text-xs whitespace-nowrap ${
            value === o.value ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
